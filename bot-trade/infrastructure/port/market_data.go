package port

import (
	"context"

	"bot-trade/domain/aggregate/market"
	pb "bot-trade/pkg/grpc-broker/vnstock"
)

// MarketDataGateway defines the interface for fetching market data from external sources.
// This is an adapter port for 3rd party stock data providers (gRPC broker service).
type MarketDataGateway interface {
	// FetchStockData fetches raw stock data for the given query.
	FetchStockData(ctx context.Context, q market.MarketDataQuery) (*pb.StockResponse, error)
}

