package provider

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"
)

const (
	minRPS          float64       = 1.0
	streakTarget    int           = 10
	increaseFactor  float64       = 1.1
	decreaseFactor  float64       = 0.7
	adjustCooldown  time.Duration = 2 * time.Second
)

// TokenBucket enforces a requests-per-second cap using a classic token-bucket
// algorithm with a dynamic refill rate. The rate grows after sustained success
// (AIMD-style) and shrinks on any upstream failure.
type TokenBucket struct {
	mu sync.Mutex

	name          string
	tokens        float64
	currentRPS    float64
	maxRPS        float64
	lastRefill    time.Time
	lastAdjustAt  time.Time
	successStreak int
}

// NewTokenBucket creates a token bucket with the given initial and maximum RPS.
// The name is used for log context so adjustments can be traced to a specific
// provider. Initial RPS is clamped into [minRPS, maxRPS].
func NewTokenBucket(name string, initialRPS, maxRPS float64) *TokenBucket {
	if maxRPS < minRPS {
		maxRPS = minRPS
	}
	if initialRPS < minRPS {
		initialRPS = minRPS
	}
	if initialRPS > maxRPS {
		initialRPS = maxRPS
	}

	now := time.Now()
	return &TokenBucket{
		name:       name,
		tokens:     initialRPS,
		currentRPS: initialRPS,
		maxRPS:     maxRPS,
		lastRefill: now,
	}
}

// Wait blocks until a token is available or the context is cancelled.
func (b *TokenBucket) Wait(ctx context.Context) error {
	for {
		b.mu.Lock()
		b.refill()

		if b.tokens >= 1.0 {
			b.tokens -= 1.0
			b.mu.Unlock()
			return nil
		}

		waitTime := time.Duration((1.0-b.tokens)/b.currentRPS) * time.Second
		b.mu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(waitTime):
			// Loop back to try again
		}
	}
}

// refill adds tokens based on elapsed time. Must be called with the mutex held.
func (b *TokenBucket) refill() {
	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.lastRefill = now

	b.tokens += elapsed * b.currentRPS
	if b.tokens > b.currentRPS {
		b.tokens = b.currentRPS
	}
}

// OnSuccess records a successful request. After streakTarget consecutive
// successes — and provided the cooldown has elapsed — RPS grows by increaseFactor.
// If the cooldown blocks the adjustment, the streak is preserved so earned
// successes are not lost.
func (b *TokenBucket) OnSuccess() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.successStreak++

	if b.successStreak < streakTarget {
		return
	}
	if b.currentRPS >= b.maxRPS {
		return
	}
	if time.Since(b.lastAdjustAt) < adjustCooldown {
		return
	}

	oldRPS := b.currentRPS
	newRPS := b.currentRPS * increaseFactor
	if newRPS > b.maxRPS {
		newRPS = b.maxRPS
	}
	b.currentRPS = newRPS
	b.successStreak = 0
	b.lastAdjustAt = time.Now()

	zap.L().Info("Token bucket increased RPS",
		zap.String("provider", b.name),
		zap.Float64("old_rps", oldRPS),
		zap.Float64("new_rps", newRPS),
	)
}

// OnFailure records any upstream failure (429, 5xx, timeout, network error).
// Decreases RPS by decreaseFactor and resets the success streak. Decreases are
// not rate-limited by the cooldown — backoff should be fast.
func (b *TokenBucket) OnFailure() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.successStreak = 0

	oldRPS := b.currentRPS
	b.currentRPS *= decreaseFactor
	if b.currentRPS < minRPS {
		b.currentRPS = minRPS
	}
	b.lastAdjustAt = time.Now()

	zap.L().Info("Token bucket decreased RPS",
		zap.String("provider", b.name),
		zap.Float64("old_rps", oldRPS),
		zap.Float64("new_rps", b.currentRPS),
	)
}

// CurrentRPS returns the current requests-per-second limit.
func (b *TokenBucket) CurrentRPS() float64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.currentRPS
}
