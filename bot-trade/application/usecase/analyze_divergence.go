package usecase

import (
	"context"
	"fmt"
	"time"

	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/service/divergence"
	"bot-trade/domain/service/indicator"

	"go.uber.org/zap"
)

var _ inbound.DivergenceAnalyzer = (*AnalyzeDivergenceUseCase)(nil)

// AnalyzeDivergenceUseCase orchestrates divergence analysis.
type AnalyzeDivergenceUseCase struct {
	configRepository  outbound.ConfigRepository
	marketDataGateway outbound.MarketDataGateway
	divergenceType    analysis.DivergenceType
	logger            *zap.Logger
}

// NewAnalyzeDivergenceUseCase creates a new divergence analysis use case.
func NewAnalyzeDivergenceUseCase(
	configRepository outbound.ConfigRepository,
	marketDataGateway outbound.MarketDataGateway,
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

// Execute performs divergence analysis for a single symbol, fetching its own market data.
func (uc *AnalyzeDivergenceUseCase) Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*analysis.AnalysisResult, error) {
	priceHistory, err := uc.marketDataGateway.FetchStockData(ctx, q)
	if err != nil {
		uc.logger.Error("Failed to fetch stock data",
			zap.String("symbol", q.Symbol),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch stock data: %w", err)
	}

	return uc.ExecuteWithData(ctx, priceHistory, q, configID)
}

// ExecuteWithData performs divergence analysis using pre-fetched price data.
func (uc *AnalyzeDivergenceUseCase) ExecuteWithData(ctx context.Context, priceHistory []*market.PriceData, q market.MarketDataQuery, configID string) (*analysis.AnalysisResult, error) {
	symbol := q.Symbol
	strategyType := uc.divergenceType.String()

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

	dataWithRSI := indicator.CalculateRSI(recentPriceHistory, tradingConfig.RSIPeriod)
	if len(dataWithRSI) == 0 {
		return nil, fmt.Errorf("insufficient data for RSI calculation")
	}

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
	var earlyDetection divergence.DetectionResult

	if uc.divergenceType == analysis.BullishDivergence {
		detection = detector.DetectBullish(dataWithRSI)
	} else {
		detection = detector.DetectBearish(dataWithRSI)
		earlyDetection = detector.DetectEarlyBearish(dataWithRSI)
	}

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
		zap.Bool("early_signal", earlyDetection.EarlySignal),
		zap.String("early_description", earlyDetection.EarlyDescription),
	)

	result := analysis.NewAnalysisResult(
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
	)

	if uc.divergenceType == analysis.BearishDivergence && earlyDetection.EarlySignal {
		result.SetEarlySignal(
			earlyDetection.EarlySignal,
			earlyDetection.EarlyDescription,
		)
	}

	return result, nil
}
