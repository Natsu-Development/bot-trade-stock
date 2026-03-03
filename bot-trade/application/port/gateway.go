package port

import (
	"context"

	"bot-trade/domain/aggregate/market"
)

// MarketDataGateway defines the interface for fetching market data from external sources.
// This is a secondary (driven) port for 3rd party stock data providers.
type MarketDataGateway interface {
	// FetchStockData fetches OHLCV price history for the given query.
	FetchStockData(ctx context.Context, q market.MarketDataQuery) ([]*market.PriceData, error)
	// ListAllStocks lists all available stock symbols for the given exchange.
	ListAllStocks(ctx context.Context, exchange string) ([]market.StockInfo, error)
}
