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
