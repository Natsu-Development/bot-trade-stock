package adapter

import (
	"context"
	"fmt"
	"time"

	"bot-trade/domain/aggregate/market"
	infraPort "bot-trade/infrastructure/port"
	pb "bot-trade/pkg/grpc-broker/vnstock"

	"google.golang.org/grpc"
)

// MarketDataGateway implements the MarketDataGateway interface using gRPC.
type MarketDataGateway struct {
	client pb.StockDataServiceClient
	conn   *grpc.ClientConn
}

// NewMarketDataGateway creates a new market data gateway.
func NewMarketDataGateway(conn *grpc.ClientConn) infraPort.MarketDataGateway {
	return &MarketDataGateway{
		client: pb.NewStockDataServiceClient(conn),
		conn:   conn,
	}
}

// FetchStockData fetches raw stock data from the gRPC broker service.
func (g *MarketDataGateway) FetchStockData(
	ctx context.Context,
	q market.MarketDataQuery,
) (*pb.StockResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	response, err := g.client.GetStockData(ctx, &pb.StockRequest{
		Symbol:    q.Symbol,
		StartDate: q.StartDate,
		EndDate:   q.EndDate,
		Interval:  q.Interval,
	})

	if err != nil {
		return nil, fmt.Errorf("gRPC call failed: %w", err)
	}

	if response.Status == "error" {
		return nil, fmt.Errorf("broker error: %s", response.Error)
	}

	return response, nil
}
