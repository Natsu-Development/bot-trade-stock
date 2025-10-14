package repositories

import (
	"context"
	"fmt"
	"time"

	"bot-trade/internal/application/dto"
	"bot-trade/internal/domain/entities"
	"bot-trade/internal/domain/repositories"
	"bot-trade/internal/domain/valueobjects"

	pb "bot-trade/pkg/grpc-broker/vnstock"

	"google.golang.org/grpc"
)

// GRPCMarketDataRepository implements MarketDataRepository using gRPC
type GRPCMarketDataRepository struct {
	client pb.StockDataServiceClient
	conn   *grpc.ClientConn
}

// NewGRPCMarketDataRepository creates a new gRPC market data repository
func NewGRPCMarketDataRepository(conn *grpc.ClientConn) repositories.MarketDataRepository {
	return &GRPCMarketDataRepository{
		client: pb.NewStockDataServiceClient(conn),
		conn:   conn,
	}
}

// GetMarketData fetches current market data for a symbol with date range and interval via gRPC
func (r *GRPCMarketDataRepository) GetMarketData(
	ctx context.Context,
	request *dto.AnalysisRequest,
) (*entities.MarketData, []*entities.PriceData, error) {

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Make gRPC call with new parameters
	response, err := r.client.GetStockData(ctx, &pb.StockRequest{
		Symbol:    request.Symbol,
		StartDate: request.StartDate,
		EndDate:   request.EndDate,
		Interval:  request.Interval,
	})

	if err != nil {
		return nil, nil, fmt.Errorf("gRPC call failed: %w", err)
	}

	if response.Status == "error" {
		return nil, nil, fmt.Errorf("server error: %s", response.Error)
	}

	// Convert protobuf response to domain entities
	marketData, err := r.convertToMarketData(request.Symbol, response.MarketData)
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
) (*entities.MarketData, error) {

	latestPrice, err := valueobjects.NewPrice(pbMarketData.LatestPrice)
	if err != nil {
		return nil, fmt.Errorf("invalid latest price: %w", err)
	}

	return entities.NewMarketData(
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
) ([]*entities.PriceData, error) {

	priceHistory := make([]*entities.PriceData, len(pbPriceHistory))

	for i, pbPrice := range pbPriceHistory {
		close, err := valueobjects.NewPrice(pbPrice.Close)
		if err != nil {
			return nil, fmt.Errorf("invalid close price at index %d: %w", i, err)
		}

		high, err := valueobjects.NewPrice(pbPrice.High)
		if err != nil {
			return nil, fmt.Errorf("invalid high price at index %d: %w", i, err)
		}

		low, err := valueobjects.NewPrice(pbPrice.Low)
		if err != nil {
			return nil, fmt.Errorf("invalid low price at index %d: %w", i, err)
		}

		priceHistory[i] = entities.NewPriceData(
			pbPrice.Date,
			close,
			high,
			low,
			pbPrice.Volume,
		)
	}

	return priceHistory, nil
}
