package port

import (
	"context"

	"bot-trade/domain/aggregate/market"
)

// MarketDataRepository defines the interface for market data access.
// This interface uses only domain types (MarketDataQuery) instead of
// application-layer DTOs, ensuring proper dependency direction.
type MarketDataRepository interface {
	// GetMarketData fetches market data for the given query.
	// Returns the market metadata, price history, and any error encountered.
	// Uses domain-specific MarketDataQuery value object for input parameters.
	GetMarketData(ctx context.Context, q market.MarketDataQuery) (*market.MarketData, []*market.PriceData, error)
}

// MarketDataResult represents the result for a single symbol.
// This can be used for batch operations or caching.
type MarketDataResult struct {
	MarketData   *market.MarketData
	PriceHistory []*market.PriceData
	Error        error
}
