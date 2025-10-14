package usecases

import (
	"context"
	"time"

	"bot-trade/internal/application/dto"
	"bot-trade/internal/domain/repositories"
	"bot-trade/internal/domain/services"
	"bot-trade/internal/domain/valueobjects"

	"go.uber.org/zap"
)

// AnalyzeBearishDivergenceUseCase handles bearish divergence analysis requests
type AnalyzeBearishDivergenceUseCase struct {
	marketDataRepo     repositories.MarketDataRepository
	rsiCalculator      *services.RSICalculatorService
	divergenceDetector *services.BearishDivergenceDetectorService
	indicesRecent      int
}

// NewAnalyzeBearishDivergenceUseCase creates a new bearish divergence analysis use case
func NewAnalyzeBearishDivergenceUseCase(
	marketDataRepo repositories.MarketDataRepository,
	rsiCalculator *services.RSICalculatorService,
	divergenceDetector *services.BearishDivergenceDetectorService,
	indicesRecent int,
) *AnalyzeBearishDivergenceUseCase {
	return &AnalyzeBearishDivergenceUseCase{
		marketDataRepo:     marketDataRepo,
		rsiCalculator:      rsiCalculator,
		divergenceDetector: divergenceDetector,
		indicesRecent:      indicesRecent,
	}
}

// Execute performs bearish divergence analysis for a single symbol
func (uc *AnalyzeBearishDivergenceUseCase) Execute(ctx context.Context, request *dto.AnalysisRequest) (*dto.DivergenceAnalysisResponse, error) {
	zap.L().Info("🔍 Bearish divergence analysis", zap.String("symbol", request.Symbol))
	startTime := time.Now()

	// Fetch market data
	_, priceHistory, err := uc.marketDataRepo.GetMarketData(ctx, request)
	if err != nil {
		return &dto.DivergenceAnalysisResponse{Symbol: request.Symbol}, err
	}

	// Calculate RSI values
	rsiValues, err := uc.rsiCalculator.CalculateRSI(priceHistory)
	if err != nil {
		return nil, err
	}

	// Get number of recent indices with price and RSI values
	priceHistory = priceHistory[len(priceHistory)-uc.indicesRecent:]
	rsiValues = rsiValues[len(rsiValues)-uc.indicesRecent:]

	// Perform divergence detection
	divergenceResult := uc.divergenceDetector.DetectDivergence(priceHistory, rsiValues)

	// Use domain methods for conversion and signal generation
	divergenceType := divergenceResult.GetTypeString()
	tradingSignal := divergenceResult.GetTradingSignal().String()

	zap.L().Info("🔍 Bearish divergence analysis completed for symbol: ",
		zap.String("symbol", request.Symbol),
		zap.String("time", time.Since(startTime).String()),
	)

	return &dto.DivergenceAnalysisResponse{
		Symbol: request.Symbol,
		Divergence: &dto.DivergenceDTO{
			Type:            divergenceType,
			Description:     divergenceResult.Description,
			DivergenceFound: divergenceResult.IsDivergenceOfType(valueobjects.BearishDivergence),
			CurrentPrice:    divergenceResult.CurrentPrice,
			CurrentRSI:      divergenceResult.CurrentRSI,
			DetectedAt:      divergenceResult.GetDetectionTime(),
			TradingSignal:   tradingSignal,
		},
		ProcessingTimeMs: time.Since(startTime).Milliseconds(),
		Parameters: &dto.ParametersDTO{
			StartDate: request.StartDate,
			EndDate:   request.EndDate,
			Interval:  request.Interval,
			RSIPeriod: 14,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
