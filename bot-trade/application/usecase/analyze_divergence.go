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

// Ensure AnalyzeDivergenceUseCase implements DivergenceAnalyzer interface
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
	symbol := q.SymbolString()
	strategyType := uc.divergenceType.String()

	uc.logger.Info(fmt.Sprintf("%s divergence analysis", strategyType), zap.String("symbol", symbol))
	startTime := time.Now()

	// Fetch raw stock data from gateway
	rawResponse, err := uc.marketDataGateway.FetchStockData(ctx, q)
	if err != nil {
		uc.logger.Error("Failed to fetch stock data",
			zap.String("symbol", symbol),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch stock data: %w", err)
	}

	// Convert raw data to domain entities using domain factory
	rawData := make([]market.RawPriceData, len(rawResponse.PriceHistory))
	for i, pb := range rawResponse.PriceHistory {
		rawData[i] = market.RawPriceData{
			Date:   pb.Date,
			Close:  pb.Close,
			High:   pb.High,
			Low:    pb.Low,
			Volume: pb.Volume,
		}
	}

	priceHistory, err := market.NewPriceHistoryFromRaw(rawData)
	if err != nil {
		uc.logger.Error("Failed to create price history",
			zap.String("symbol", symbol),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to create price history: %w", err)
	}

	// Check if we have enough data
	if len(priceHistory) < uc.indicesRecent {
		uc.logger.Warn("Insufficient price data",
			zap.String("symbol", symbol),
			zap.Int("required", uc.indicesRecent),
			zap.Int("actual", len(priceHistory)),
		)
		return nil, fmt.Errorf("insufficient price data: required %d, got %d", uc.indicesRecent, len(priceHistory))
	}

	// Get recent price data
	recentPriceHistory := priceHistory[len(priceHistory)-uc.indicesRecent:]

	// Perform divergence detection based on type
	var divergenceResult *analysis.DivergenceResult
	if uc.divergenceType == analysis.BullishDivergence {
		divergenceResult = uc.divergenceDetector.DetectBullish(recentPriceHistory)
	} else {
		divergenceResult = uc.divergenceDetector.DetectBearish(recentPriceHistory)
	}

	processingTime := time.Since(startTime)
	uc.logger.Info(fmt.Sprintf("%s divergence analysis completed", strategyType),
		zap.String("symbol", symbol),
		zap.Duration("duration", processingTime),
		zap.Bool("divergence_found", divergenceResult.DivergenceFound()),
	)

	return analysis.NewAnalysisResult(
		symbol,
		divergenceResult,
		processingTime.Milliseconds(),
		q,
		uc.rsiPeriod,
	), nil
}
