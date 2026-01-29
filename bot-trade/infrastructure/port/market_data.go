package port

import (
	"context"

	"bot-trade/domain/aggregate/market"
)

// MarketDataGateway defines the interface for fetching market data from external sources.
// This is an adapter port for 3rd party stock data providers.
type MarketDataGateway interface {
	// FetchStockData fetches raw stock data for the given query.
	FetchStockData(ctx context.Context, q market.MarketDataQuery) (*market.StockDataResponse, error)
	// ListAllStocks lists all available stock symbols.
	ListAllStocks(ctx context.Context, exchange string) (*market.ListStocksResponse, error)
}