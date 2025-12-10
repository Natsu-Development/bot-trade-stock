package usecase

import (
	"context"
	"fmt"
	"time"

	appPort "bot-trade/application/port"
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
	domainPort "bot-trade/domain/port"
	"bot-trade/domain/service/divergence"

	"go.uber.org/zap"
)

// Ensure AnalyzeDivergenceUseCase implements DivergenceAnalyzer interface
var _ appPort.DivergenceAnalyzer = (*AnalyzeDivergenceUseCase)(nil)

// AnalyzeDivergenceUseCase orchestrates divergence analysis.
type AnalyzeDivergenceUseCase struct {
	marketDataRepo     domainPort.MarketDataRepository
	divergenceDetector *divergence.Detector
	divergenceType     analysis.DivergenceType
	logger             *zap.Logger
	indicesRecent      int
	rsiPeriod          int
}

// NewAnalyzeDivergenceUseCase creates a new divergence analysis use case.
func NewAnalyzeDivergenceUseCase(
	marketDataRepo domainPort.MarketDataRepository,
	divergenceDetector *divergence.Detector,
	divergenceType analysis.DivergenceType,
	logger *zap.Logger,
	indicesRecent int,
	rsiPeriod int,
) *AnalyzeDivergenceUseCase {
	return &AnalyzeDivergenceUseCase{
		marketDataRepo:     marketDataRepo,
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

	// Fetch market data
	_, priceHistory, err := uc.marketDataRepo.GetMarketData(ctx, q)
	if err != nil {
		uc.logger.Error("Failed to fetch market data",
			zap.String("symbol", symbol),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch market data: %w", err)
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
