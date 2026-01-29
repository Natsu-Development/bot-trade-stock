package usecase

import (
	"context"
	"fmt"
	"time"

	appPort "bot-trade/application/port"
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/service/divergence"
	infraPort "bot-trade/infrastructure/port"

	"go.uber.org/zap"
)

var _ appPort.DivergenceAnalyzer = (*AnalyzeDivergenceUseCase)(nil)

// AnalyzeDivergenceUseCase orchestrates divergence analysis.
type AnalyzeDivergenceUseCase struct {
	configRepository  infraPort.ConfigRepository
	marketDataGateway infraPort.MarketDataGateway
	divergenceType    analysis.DivergenceType
	logger            *zap.Logger
}

// NewAnalyzeDivergenceUseCase creates a new divergence analysis use case.
func NewAnalyzeDivergenceUseCase(
	configRepository infraPort.ConfigRepository,
	marketDataGateway infraPort.MarketDataGateway,
	divergenceType analysis.DivergenceType,
	logger *zap.Logger,
) *AnalyzeDivergenceUseCase {
	return &AnalyzeDivergenceUseCase{
		configRepository:  configRepository,
		marketDataGateway: marketDataGateway,
		divergenceType:    divergenceType,
		logger:            logger,
	}
}

// Execute performs divergence analysis for a single symbol using configuration loaded from repository.
func (uc *AnalyzeDivergenceUseCase) Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*analysis.AnalysisResult, error) {
	symbol := q.Symbol
	strategyType := uc.divergenceType.String()

	// Load configuration from repository
	tradingConfig, err := uc.configRepository.GetByID(ctx, configID)
	if err != nil {
		uc.logger.Error("Failed to load trading configuration",
			zap.String("configID", configID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to load trading configuration: %w", err)
	}

	uc.logger.Info(fmt.Sprintf("%s divergence analysis", strategyType),
		zap.String("symbol", symbol),
		zap.String("configID", configID),
	)
	startTime := time.Now()

	response, err := uc.marketDataGateway.FetchStockData(ctx, q)
	if err != nil {
		uc.logger.Error("Failed to fetch stock data",
			zap.String("symbol", symbol),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch stock data: %w", err)
	}

	priceHistory := response.PriceHistory

	indicesRecent := tradingConfig.Divergence.IndicesRecent
	if len(priceHistory) < indicesRecent {
		uc.logger.Warn("Insufficient price data",
			zap.String("symbol", symbol),
			zap.Int("required", indicesRecent),
			zap.Int("actual", len(priceHistory)),
		)
		return nil, fmt.Errorf("insufficient price data: required %d, got %d", indicesRecent, len(priceHistory))
	}

	recentPriceHistory := priceHistory[len(priceHistory)-indicesRecent:]

	// Enrich price data with RSI values using config's RSI period
	dataWithRSI := market.CalculateRSI(recentPriceHistory, tradingConfig.RSIPeriod)
	if len(dataWithRSI) == 0 {
		return nil, fmt.Errorf("insufficient data for RSI calculation")
	}

	// Create detector per-request using config's divergence parameters
	detectorConfig, err := divergence.NewConfig(
		tradingConfig.Divergence.LookbackLeft,
		tradingConfig.Divergence.LookbackRight,
		tradingConfig.Divergence.RangeMin,
		tradingConfig.Divergence.RangeMax,
	)
	if err != nil {
		return nil, fmt.Errorf("invalid divergence configuration: %w", err)
	}
	detector := divergence.NewDetector(detectorConfig)

	var detection divergence.DetectionResult
	if uc.divergenceType == analysis.BullishDivergence {
		detection = detector.DetectBullish(dataWithRSI)
	} else {
		detection = detector.DetectBearish(dataWithRSI)
	}

	// Get current price/RSI from last valid data point
	var currentPrice, currentRSI float64
	for i := len(dataWithRSI) - 1; i >= 0; i-- {
		if dataWithRSI[i].RSI != 0 {
			currentPrice = dataWithRSI[i].Close
			currentRSI = dataWithRSI[i].RSI
			break
		}
	}

	processingTime := time.Since(startTime)
	uc.logger.Info(fmt.Sprintf("%s divergence analysis completed", strategyType),
		zap.String("symbol", symbol),
		zap.Duration("duration", processingTime),
		zap.Bool("divergence_found", detection.Found),
	)

	return analysis.NewAnalysisResult(
		symbol,
		detection.Type,
		detection.Found,
		currentPrice,
		currentRSI,
		detection.Description,
		processingTime.Milliseconds(),
		q.StartDate,
		q.EndDate,
		q.Interval,
		tradingConfig.RSIPeriod,
	), nil
}
