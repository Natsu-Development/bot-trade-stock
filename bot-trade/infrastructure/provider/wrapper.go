package provider

import (
	"context"
	"errors"
	"sync/atomic"

	marketvo "bot-trade/domain/shared/valueobject/market"
	"bot-trade/infrastructure/provider/contract"
)

// WrappedProvider wraps a Provider with rate limiting and health tracking.
type WrappedProvider struct {
	source  contract.Provider
	limiter *RateLimiter
	healthy atomic.Bool
}

// NewWrappedProvider creates a new wrapped provider.
func NewWrappedProvider(p contract.Provider, limiter *RateLimiter) *WrappedProvider {
	w := &WrappedProvider{
		source:  p,
		limiter: limiter,
	}
	w.healthy.Store(true) // Start healthy to allow initial selection
	return w
}

// Name returns the underlying provider name.
func (w *WrappedProvider) Name() string {
	return w.source.Name()
}

// FetchObserved fetches OHLCV bars with rate limiting and health tracking.
func (w *WrappedProvider) FetchObserved(ctx context.Context, q marketvo.MarketDataQuery) ([]marketvo.MarketData, error) {
	if err := w.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	result, err := w.source.FetchBars(ctx, q)
	if err != nil {
		if errors.Is(err, contract.ErrRateLimited) {
			w.limiter.OnRateLimited()
			w.healthy.Store(false)
		}
		return nil, err
	}

	w.limiter.OnSuccess()
	w.healthy.Store(true)
	return result, nil
}

// IsHealthy returns true if the provider is healthy.
func (w *WrappedProvider) IsHealthy() bool {
	return w.healthy.Load()
}
