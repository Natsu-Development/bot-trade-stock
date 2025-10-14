package repositories

import (
	"context"

	"bot-trade/internal/application/dto"
	"bot-trade/internal/domain/entities"
)

// MarketDataRepository defines the interface for market data access
type MarketDataRepository interface {
	// GetMarketData fetches current market data for a symbol with date range and interval
	GetMarketData(ctx context.Context, request *dto.AnalysisRequest) (*entities.MarketData, []*entities.PriceData, error)
}

// MarketDataResult represents the result for a single symbol
type MarketDataResult struct {
	MarketData   *entities.MarketData
	PriceHistory []*entities.PriceData
	Error        error
}
