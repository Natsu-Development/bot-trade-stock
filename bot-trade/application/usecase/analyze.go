package usecase

import (
	"context"
	"fmt"
	"time"

	appPort "bot-trade/application/port"
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
	infraPort "bot-trade/infrastructure/port"

	"go.uber.org/zap"
)

var _ appPort.Analyzer = (*AnalyzeUseCase)(nil)

// AnalyzeUseCase orchestrates all analysis types (bullish divergence, bearish divergence, trendline)
// in a single unified use case. This optimizes performance by fetching market data once
// and sharing it across all analyses.
type AnalyzeUseCase struct {
	configRepository  infraPort.ConfigRepository
	marketDataGateway infraPort.MarketDataGateway
	bullishAnalyzer   appPort.DivergenceAnalyzer
	bearishAnalyzer   appPort.DivergenceAnalyzer
	trendlineAnalyzer appPort.TrendlineAnalyzer
	logger            *zap.Logger
}

// NewAnalyzeUseCase creates a new unified analysis use case.
func NewAnalyzeUseCase(
	configRepository infraPort.ConfigRepository,
	marketDataGateway infraPort.MarketDataGateway,
	bullishAnalyzer appPort.DivergenceAnalyzer,
	bearishAnalyzer appPort.DivergenceAnalyzer,
	trendlineAnalyzer appPort.TrendlineAnalyzer,
	logger *zap.Logger,
) *AnalyzeUseCase {
	return &AnalyzeUseCase{
		configRepository:  configRepository,
		marketDataGateway: marketDataGateway,
		bullishAnalyzer:   bullishAnalyzer,
		bearishAnalyzer:   bearishAnalyzer,
		trendlineAnalyzer: trendlineAnalyzer,
		logger:            logger,
	}
}

// Execute performs all analysis types for a single symbol.
// This includes bullish divergence, bearish divergence, and trendline signals.
func (uc *AnalyzeUseCase) Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*market.CombinedAnalysisResult, error) {
	symbol := q.Symbol

	// Load configuration from repository
	_, err := uc.configRepository.GetByID(ctx, configID)
	if err != nil {
		uc.logger.Error("Failed to load trading configuration",
			zap.String("configID", configID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to load trading configuration: %w", err)
	}

	uc.logger.Info("Unified analysis",
		zap.String("symbol", symbol),
		zap.String("configID", configID),
	)
	startTime := time.Now()

	// Run all analyses in parallel using goroutines
	type resultPair struct {
		result *analysis.AnalysisResult
		err    error
	}

	type signalPair struct {
		result *market.SignalAnalysisResult
		err    error
	}

	bullishCh := make(chan resultPair, 1)
	bearishCh := make(chan resultPair, 1)
	signalsCh := make(chan signalPair, 1)

	// Run bullish divergence analysis
	go func() {
		result, err := uc.bullishAnalyzer.Execute(ctx, q, configID)
		bullishCh <- resultPair{result, err}
	}()

	// Run bearish divergence analysis
	go func() {
		result, err := uc.bearishAnalyzer.Execute(ctx, q, configID)
		bearishCh <- resultPair{result, err}
	}()

	// Run trendline signal analysis
	go func() {
		result, err := uc.trendlineAnalyzer.Execute(ctx, q, configID)
		signalsCh <- signalPair{result, err}
	}()

	// Collect results
	bullishResult := <-bullishCh
	bearishResult := <-bearishCh
	signalsResult := <-signalsCh

	// Check for errors
	if bullishResult.err != nil {
		return nil, fmt.Errorf("bullish divergence analysis failed: %w", bullishResult.err)
	}
	if bearishResult.err != nil {
		return nil, fmt.Errorf("bearish divergence analysis failed: %w", bearishResult.err)
	}
	if signalsResult.err != nil {
		return nil, fmt.Errorf("trendline signal analysis failed: %w", signalsResult.err)
	}

	processingTime := time.Since(startTime)

	// Create combined result
	combinedResult := market.NewCombinedAnalysisResult(
		symbol,
		processingTime.Milliseconds(),
		q.StartDate,
		q.EndDate,
		q.Interval,
		signalsResult.result.CurrentPrice,
	)

	// Set bullish divergence result
	if bullishResult.result != nil {
		combinedResult.SetBullishDivergence(
			bullishResult.result.DivergenceType.String(),
			bullishResult.result.DivergenceFound,
			bullishResult.result.CurrentPrice,
			bullishResult.result.CurrentRSI,
			bullishResult.result.Description,
			bullishResult.result.ProcessingTimeMs,
			bullishResult.result.StartDate,
			bullishResult.result.EndDate,
			bullishResult.result.Interval,
			bullishResult.result.RSIPeriod,
			bullishResult.result.Timestamp,
			bullishResult.result.EarlySignalDetected,
			bullishResult.result.EarlyDescription,
		)
	}

	// Set bearish divergence result
	if bearishResult.result != nil {
		combinedResult.SetBearishDivergence(
			bearishResult.result.DivergenceType.String(),
			bearishResult.result.DivergenceFound,
			bearishResult.result.CurrentPrice,
			bearishResult.result.CurrentRSI,
			bearishResult.result.Description,
			bearishResult.result.ProcessingTimeMs,
			bearishResult.result.StartDate,
			bearishResult.result.EndDate,
			bearishResult.result.Interval,
			bearishResult.result.RSIPeriod,
			bearishResult.result.Timestamp,
			bearishResult.result.EarlySignalDetected,
			bearishResult.result.EarlyDescription,
		)
	}

	// Set signals
	if signalsResult.result != nil {
		combinedResult.SetSignals(signalsResult.result.Signals)
		combinedResult.SetPriceHistory(signalsResult.result.PriceHistory)
		combinedResult.SetTrendlines(signalsResult.result.Trendlines)
	}

	uc.logger.Info("Unified analysis completed",
		zap.String("symbol", symbol),
		zap.Duration("duration", processingTime),
		zap.Bool("bullish_divergence", combinedResult.BullishDivergence != nil && combinedResult.BullishDivergence.DivergenceFound),
		zap.Bool("bearish_divergence", combinedResult.BearishDivergence != nil && combinedResult.BearishDivergence.DivergenceFound),
		zap.Int("signals_count", len(combinedResult.Signals)),
	)

	return combinedResult, nil
}

// ValidateConfig checks if the given config ID exists.
func (uc *AnalyzeUseCase) ValidateConfig(ctx context.Context, configID string) error {
	_, err := uc.configRepository.GetByID(ctx, configID)
	return err
}
