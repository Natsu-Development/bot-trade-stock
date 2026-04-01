package provider

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"
)

const (
	minRPS       float64 = 1.0
	maxRPS       float64 = 300.0
	streakTarget int     = 10
)

// RateLimiter implements a token bucket with dynamic RPS adjustment.
type RateLimiter struct {
	mu sync.Mutex

	tokens        float64
	currentRPS    float64
	lastRefill    time.Time
	successStreak int
}

// NewRateLimiter creates a new rate limiter.
func NewRateLimiter(initialRPS float64) *RateLimiter {
	if initialRPS < minRPS {
		initialRPS = minRPS
	}
	if initialRPS > maxRPS {
		initialRPS = maxRPS
	}

	now := time.Now()
	return &RateLimiter{
		tokens:     initialRPS,
		currentRPS: initialRPS,
		lastRefill: now,
	}
}

// Wait blocks until a token is available or context is cancelled.
func (l *RateLimiter) Wait(ctx context.Context) error {
	for {
		l.mu.Lock()
		l.refill()

		if l.tokens >= 1.0 {
			l.tokens -= 1.0
			l.mu.Unlock()
			return nil
		}

		waitTime := time.Duration((1.0-l.tokens)/l.currentRPS) * time.Second
		l.mu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(waitTime):
			// Loop back to try again
		}
	}
}

// refill adds tokens based on elapsed time.
// Must be called with mutex held.
func (l *RateLimiter) refill() {
	now := time.Now()
	elapsed := now.Sub(l.lastRefill).Seconds()
	l.lastRefill = now

	l.tokens += elapsed * l.currentRPS
	if l.tokens > l.currentRPS {
		l.tokens = l.currentRPS
	}
}

// OnSuccess records a successful request.
// After streakTarget consecutive successes, increases RPS by 10%.
func (l *RateLimiter) OnSuccess() {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.successStreak++

	if l.successStreak >= streakTarget && l.currentRPS < maxRPS {
		newRPS := l.currentRPS * 1.1
		if newRPS > maxRPS {
			newRPS = maxRPS
		}
		l.currentRPS = newRPS
		l.successStreak = 0

		zap.L().Debug("Rate limiter increased RPS",
			zap.Float64("new_rps", newRPS),
		)
	}
}

// OnRateLimited handles a rate limit error.
// Decreases RPS by 30% and resets success streak.
func (l *RateLimiter) OnRateLimited() {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.successStreak = 0
	l.currentRPS *= 0.7

	if l.currentRPS < minRPS {
		l.currentRPS = minRPS
	}

	zap.L().Debug("Rate limiter decreased RPS due to 429",
		zap.Float64("new_rps", l.currentRPS),
	)
}
