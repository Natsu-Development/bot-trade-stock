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
	marketDataGateway  infraPort.MarketDataGateway
	divergenceDetector *divergence.Detector
	divergenceType     analysis.DivergenceType
	logger             *zap.Logger
	indicesRecent      int
	rsiPeriod          int
}

// NewAnalyzeDivergenceUseCase creates a new divergence analysis use case.
func NewAnalyzeDivergenceUseCase(
	marketDataGateway infraPort.MarketDataGateway,
	divergenceDetector *divergence.Detector,
	divergenceType analysis.DivergenceType,
	logger *zap.Logger,
	indicesRecent int,
	rsiPeriod int,
) *AnalyzeDivergenceUseCase {
	return &AnalyzeDivergenceUseCase{
		marketDataGateway:  marketDataGateway,
		divergenceDetector: divergenceDetector,
		divergenceType:     divergenceType,
		logger:             logger,
		indicesRecent:      indicesRecent,
		rsiPeriod:          rsiPeriod,
	}
}

// Execute performs divergence analysis for a single symbol.
func (uc *AnalyzeDivergenceUseCase) Execute(ctx context.Context, q market.MarketDataQuery) (*analysis.AnalysisResult, error) {
	symbol := q.Symbol
	strategyType := uc.divergenceType.String()

	uc.logger.Info(fmt.Sprintf("%s divergence analysis", strategyType), zap.String("symbol", symbol))
	startTime := time.Now()

	rawResponse, err := uc.marketDataGateway.FetchStockData(ctx, q)
	if err != nil {
		uc.logger.Error("Failed to fetch stock data",
			zap.String("symbol", symbol),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch stock data: %w", err)
	}

	priceHistory := make([]*market.PriceData, len(rawResponse.PriceHistory))
	for i, pb := range rawResponse.PriceHistory {
		priceHistory[i] = &market.PriceData{
			Date:  pb.Date,
			Close: pb.Close,
		}
	}

	if len(priceHistory) < uc.indicesRecent {
		uc.logger.Warn("Insufficient price data",
			zap.String("symbol", symbol),
			zap.Int("required", uc.indicesRecent),
			zap.Int("actual", len(priceHistory)),
		)
		return nil, fmt.Errorf("insufficient price data: required %d, got %d", uc.indicesRecent, len(priceHistory))
	}

	recentPriceHistory := priceHistory[len(priceHistory)-uc.indicesRecent:]

	// Enrich price data with RSI values
	dataWithRSI := market.CalculateRSI(recentPriceHistory, uc.rsiPeriod)
	if len(dataWithRSI) == 0 {
		return nil, fmt.Errorf("insufficient data for RSI calculation")
	}

	var detection divergence.DetectionResult
	if uc.divergenceType == analysis.BullishDivergence {
		detection = uc.divergenceDetector.DetectBullish(dataWithRSI)
	} else {
		detection = uc.divergenceDetector.DetectBearish(dataWithRSI)
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
		uc.rsiPeriod,
	), nil
}
