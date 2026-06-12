package outbound

import (
	"context"

	marketvo "backend/domain/shared/valueobject/market"
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

// QuoteProvider fetches real-time market quotes for all symbols.
//
// FetchAllQuotes MUST return MarketQuote with every per-share price field in kVND (thousands of VND).
// Scale normalization is the adapter's responsibility at the infrastructure boundary
// (e.g. SSI's normalizedQuoteFromItem divides raw VND by 1000); there is no app-layer gate.
type QuoteProvider interface {
	FetchAllQuotes(ctx context.Context) (map[string]marketvo.MarketQuote, error)
}
