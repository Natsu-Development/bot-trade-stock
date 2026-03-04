package outbound

import (
	"context"

	"bot-trade/domain/aggregate/market"
)

// MarketDataGateway defines the interface for fetching market data from external sources.
type MarketDataGateway interface {
	FetchStockData(ctx context.Context, q market.MarketDataQuery) ([]market.MarketData, error)
	ListAllStocks(ctx context.Context, exchange string) ([]market.StockInfo, error)
}
