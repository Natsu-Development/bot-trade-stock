package outbound

import (
	"context"

	marketvo "bot-trade/domain/shared/valueobject/market"
)

// MarketGateway defines the core interface for fetching market data.
type MarketGateway interface {
	// FetchData fetches OHLCV data for a single symbol.
	FetchData(ctx context.Context, q marketvo.MarketDataQuery) ([]marketvo.MarketData, error)
}

// StockLister is an optional interface for providers that can list all stocks.
// Providers that don't support this should not implement this interface.
type StockLister interface {
	ListAllStocks(ctx context.Context) ([]marketvo.StockInfo, error)
}
