package outbound

import (
	"context"

	marketvo "bot-trade/domain/shared/valueobject/market"
)

// MarketDataGateway defines the interface for fetching market data from external sources.
type MarketDataGateway interface {
	FetchStockData(ctx context.Context, q marketvo.MarketDataQuery) ([]marketvo.MarketData, error)
	ListAllStocks(ctx context.Context, exchange string) ([]marketvo.StockInfo, error)
}
