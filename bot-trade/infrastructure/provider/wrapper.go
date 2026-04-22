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
	bucket  *TokenBucket
	healthy atomic.Bool
	metrics *metrics.ProviderMetrics
}

// NewWrappedProvider creates a new wrapped provider with metrics.
func NewWrappedProvider(p contract.Provider, bucket *TokenBucket, m *metrics.ProviderMetrics) *WrappedProvider {
	w := &WrappedProvider{
		source:  p,
		bucket:  bucket,
		metrics: m,
	}
	w.healthy.Store(true)

	if m != nil {
		m.InitProvider(p.Name(), bucket.CurrentRPS())
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

	// Wait for token bucket
	if err := w.bucket.Wait(ctx); err != nil {
		tracker.EndRequest(err, false, w.bucket.CurrentRPS())
		return nil, err
	}

	// Execute request
	result, err := w.source.FetchBars(ctx, q)

	isRateLimited := errors.Is(err, contract.ErrRateLimited)
	isForbidden := errors.Is(err, contract.ErrForbidden)
	isNoData := errors.Is(err, contract.ErrNoData)

	switch {
	case err == nil:
		w.bucket.OnSuccess()
		w.healthy.Store(true)
	case isNoData:
		// Provider is healthy — symbol just has no data. Let the pool failover
		// to the next provider without adjusting RPS.
	default:
		w.bucket.OnFailure()
		if isRateLimited || isForbidden {
			w.healthy.Store(false)
		}
	}

	tracker.EndRequest(err, isRateLimited || isForbidden, w.bucket.CurrentRPS())

	return result, err
}

// IsHealthy returns true if the provider is healthy.
func (w *WrappedProvider) IsHealthy() bool {
	return w.healthy.Load()
}
