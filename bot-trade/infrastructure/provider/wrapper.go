package provider

import (
	"context"
	"errors"
	"sync/atomic"

	marketvo "bot-trade/domain/shared/valueobject/market"
	"bot-trade/infrastructure/metrics"
	"bot-trade/infrastructure/provider/contract"
)

// WrappedProvider wraps a Provider with rate limiting, health tracking, and metrics.
type WrappedProvider struct {
	source  contract.Provider
	limiter *RateLimiter
	healthy atomic.Bool
	metrics *metrics.ProviderMetrics
}

// NewWrappedProvider creates a new wrapped provider with metrics.
func NewWrappedProvider(p contract.Provider, limiter *RateLimiter, m *metrics.ProviderMetrics) *WrappedProvider {
	w := &WrappedProvider{
		source:  p,
		limiter: limiter,
		metrics: m,
	}
	w.healthy.Store(true)

	if m != nil {
		m.InitProvider(p.Name(), limiter.CurrentRPS())
	}

	return w
}

// Name returns the underlying provider name.
func (w *WrappedProvider) Name() string {
	return w.source.Name()
}

// FetchObserved fetches OHLCV bars with rate limiting, health tracking, and metrics.
func (w *WrappedProvider) FetchObserved(ctx context.Context, q marketvo.MarketDataQuery) ([]marketvo.MarketData, error) {
	providerName := w.source.Name()

	// Start metrics tracking
	tracker := w.metrics.BeginRequest(providerName)

	// Wait for rate limiter
	if err := w.limiter.Wait(ctx); err != nil {
		tracker.EndRequest(err, false, w.limiter.CurrentRPS())
		return nil, err
	}

	// Execute request
	result, err := w.source.FetchBars(ctx, q)

	// Handle rate limit specially
	isRateLimited := errors.Is(err, contract.ErrRateLimited)
	if isRateLimited {
		w.limiter.OnRateLimited()
		w.healthy.Store(false)
	} else if err == nil {
		w.limiter.OnSuccess()
		w.healthy.Store(true)
	}

	// Record metrics (all logic in metrics package)
	tracker.EndRequest(err, isRateLimited, w.limiter.CurrentRPS())

	return result, err
}

// IsHealthy returns true if the provider is healthy.
func (w *WrappedProvider) IsHealthy() bool {
	return w.healthy.Load()
}
