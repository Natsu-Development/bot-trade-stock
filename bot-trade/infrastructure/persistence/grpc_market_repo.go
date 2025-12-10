package persistence

import (
	"context"
	"fmt"
	"time"

	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/port"

	pb "bot-trade/pkg/grpc-broker/vnstock"

	"google.golang.org/grpc"
)

// GRPCMarketDataRepository implements MarketDataRepository using gRPC
type GRPCMarketDataRepository struct {
	client pb.StockDataServiceClient
	conn   *grpc.ClientConn
}

// NewGRPCMarketDataRepository creates a new gRPC market data repository
func NewGRPCMarketDataRepository(conn *grpc.ClientConn) port.MarketDataRepository {
	return &GRPCMarketDataRepository{
		client: pb.NewStockDataServiceClient(conn),
		conn:   conn,
	}
}

// GetMarketData fetches current market data for a symbol with date range and interval via gRPC.
// Implements MarketDataRepository interface using domain MarketDataQuery value object.
func (r *GRPCMarketDataRepository) GetMarketData(
	ctx context.Context,
	q market.MarketDataQuery,
) (*market.MarketData, []*market.PriceData, error) {

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Make gRPC call with query parameters from domain value object
	response, err := r.client.GetStockData(ctx, &pb.StockRequest{
		Symbol:    q.SymbolString(),
		StartDate: q.StartDate(),
		EndDate:   q.EndDate(),
		Interval:  q.IntervalString(),
	})

	if err != nil {
		return nil, nil, fmt.Errorf("gRPC call failed: %w", err)
	}

	if response.Status == "error" {
		return nil, nil, fmt.Errorf("server error: %s", response.Error)
	}

	// Convert protobuf response to domain entities
	marketData, err := r.convertToMarketData(q.SymbolString(), response.MarketData)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to convert market data: %w", err)
	}

	priceHistory, err := r.convertToPriceData(response.PriceHistory)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to convert price history: %w", err)
	}

	return marketData, priceHistory, nil
}

// convertToMarketData converts protobuf MarketData to domain entity
func (r *GRPCMarketDataRepository) convertToMarketData(
	symbol string,
	pbMarketData *pb.MarketData,
) (*market.MarketData, error) {

	latestPrice, err := market.NewPrice(pbMarketData.LatestPrice)
	if err != nil {
		return nil, fmt.Errorf("invalid latest price: %w", err)
	}

	return market.NewMarketData(
		symbol,
		latestPrice,
		pbMarketData.PriceChange,
		pbMarketData.PriceChangePercent,
		pbMarketData.CurrentVolume,
		pbMarketData.VolumeRatio,
		pbMarketData.PriceVolatility,
		pbMarketData.TradingDate,
	), nil
}

// convertToPriceData converts protobuf PriceData slice to domain entities
func (r *GRPCMarketDataRepository) convertToPriceData(
	pbPriceHistory []*pb.PriceData,
) ([]*market.PriceData, error) {

	priceHistory := make([]*market.PriceData, len(pbPriceHistory))

	for i, pbPrice := range pbPriceHistory {
		close, err := market.NewPrice(pbPrice.Close)
		if err != nil {
			return nil, fmt.Errorf("invalid close price at index %d: %w", i, err)
		}

		high, err := market.NewPrice(pbPrice.High)
		if err != nil {
			return nil, fmt.Errorf("invalid high price at index %d: %w", i, err)
		}

		low, err := market.NewPrice(pbPrice.Low)
		if err != nil {
			return nil, fmt.Errorf("invalid low price at index %d: %w", i, err)
		}

		priceData, err := market.NewPriceData(
			pbPrice.Date,
			close,
			high,
			low,
			pbPrice.Volume,
		)
		if err != nil {
			return nil, fmt.Errorf("invalid price data at index %d: %w", i, err)
		}

		priceHistory[i] = priceData
	}

	return priceHistory, nil
}
