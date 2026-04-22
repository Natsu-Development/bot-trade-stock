package contract

import (
	"context"
	"errors"

	marketvo "bot-trade/domain/shared/valueobject/market"
)

// Provider defines the interface for a market data provider.
type Provider interface {
	// Name returns the provider name for logging and debugging.
	Name() string

	// FetchBars fetches OHLCV bars for a single symbol.
	FetchBars(ctx context.Context, q marketvo.MarketDataQuery) ([]marketvo.MarketData, error)
}

// ErrRateLimited indicates the provider has been rate limited (HTTP 429).
var ErrRateLimited = errors.New("rate limited")

// ErrForbidden indicates the provider returned HTTP 403 Forbidden.
// This typically means API key is invalid, expired, or blocked.
var ErrForbidden = errors.New("forbidden")

// ErrNoData indicates the provider responded successfully but had no bars for
// the query (e.g., delisted symbol, unknown ticker). Triggers failover to the
// next provider in the pool but does not adjust the provider's RPS — the
// provider is functioning correctly, there is simply nothing to return.
var ErrNoData = errors.New("no data")
