package usecase

import (
	"context"
	"fmt"
	"time"

	appPort "bot-trade/application/port"
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"

	"go.uber.org/zap"
)

var _ appPort.Analyzer = (*AnalyzeUseCase)(nil)

// AnalyzeUseCase orchestrates all analysis types (bullish divergence, bearish divergence, trendline)
// in a single unified use case. This optimizes performance by fetching market data once
// and sharing it across all analyses.
type AnalyzeUseCase struct {
	configRepository  appPort.ConfigRepository
	marketDataGateway appPort.MarketDataGateway
	bullishAnalyzer   appPort.DivergenceAnalyzer
	bearishAnalyzer   appPort.DivergenceAnalyzer
	trendlineAnalyzer appPort.TrendlineAnalyzer
	logger            *zap.Logger
}

// NewAnalyzeUseCase creates a new unified analysis use case.
func NewAnalyzeUseCase(
	configRepository appPort.ConfigRepository,
	marketDataGateway appPort.MarketDataGateway,
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
// Fetches market data once and shares it across all sub-analyzers to avoid redundant API calls.
func (uc *AnalyzeUseCase) Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*market.CombinedAnalysisResult, error) {
	symbol := q.Symbol

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

	// Fetch market data once for all sub-analyzers
	priceHistory, err := uc.marketDataGateway.FetchStockData(ctx, q)
	if err != nil {
		uc.logger.Error("Failed to fetch stock data",
			zap.String("symbol", symbol),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch stock data: %w", err)
	}

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

	go func() {
		result, err := uc.bullishAnalyzer.ExecuteWithData(ctx, priceHistory, q, configID)
		bullishCh <- resultPair{result, err}
	}()

	go func() {
		result, err := uc.bearishAnalyzer.ExecuteWithData(ctx, priceHistory, q, configID)
		bearishCh <- resultPair{result, err}
	}()

	go func() {
		result, err := uc.trendlineAnalyzer.ExecuteWithData(ctx, priceHistory, q, configID)
		signalsCh <- signalPair{result, err}
	}()

	bullishResult := <-bullishCh
	bearishResult := <-bearishCh
	signalsResult := <-signalsCh

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

	if bullishResult.result != nil {
		combinedResult.SetBullishDivergence(bullishResult.result)
	}
	if bearishResult.result != nil {
		combinedResult.SetBearishDivergence(bearishResult.result)
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
		zap.Bool("bullish_divergence", combinedResult.BullishDivergence != nil && combinedResult.BullishDivergence.HasDivergence()),
		zap.Bool("bearish_divergence", combinedResult.BearishDivergence != nil && combinedResult.BearishDivergence.HasDivergence()),
		zap.Int("signals_count", len(combinedResult.Signals)),
	)

	return combinedResult, nil
}

// ValidateConfig checks if the given config ID exists.
func (uc *AnalyzeUseCase) ValidateConfig(ctx context.Context, configID string) error {
	_, err := uc.configRepository.GetByID(ctx, configID)
	return err
}
