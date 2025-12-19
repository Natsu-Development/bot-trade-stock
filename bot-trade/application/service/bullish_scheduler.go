package service

import (
	"context"
	"fmt"

	appPort "bot-trade/application/port"
	"bot-trade/config"
	"bot-trade/domain/aggregate/analysis"
	infraPort "bot-trade/infrastructure/port"

	"go.uber.org/zap"
)

// BullishCronScheduler handles automated bullish divergence analysis.
type BullishCronScheduler struct {
	*BaseCronScheduler
	analyzer  appPort.DivergenceAnalyzer
	intervals map[string]config.IntervalConfig
}

// NewBullishCronScheduler creates a new bullish cron scheduler.
func NewBullishCronScheduler(
	logger *zap.Logger,
	notifier infraPort.Notifier,
	analyzer appPort.DivergenceAnalyzer,
	symbols []string,
	startDateOffset int,
	intervals map[string]config.IntervalConfig,
) *BullishCronScheduler {
	return &BullishCronScheduler{
		BaseCronScheduler: NewBaseCronScheduler(
			logger, notifier, symbols, analysis.BullishDivergence, startDateOffset,
		),
		analyzer:  analyzer,
		intervals: intervals,
	}
}

// Start starts the bullish cron scheduler for all enabled intervals.
func (bcs *BullishCronScheduler) Start() error {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()

	if bcs.isRunning {
		return fmt.Errorf("bullish scheduler already running")
	}

	jobCount := 0
	for interval, cfg := range bcs.intervals {
		if cfg.Enabled && cfg.Schedule != "" {
			bcs.registerInterval(interval, cfg.Schedule)
			jobCount++
		}
	}

	if jobCount == 0 {
		return fmt.Errorf("no intervals enabled")
	}

	bcs.cron.Start()
	bcs.isRunning = true

	bcs.logger.Info("Bullish scheduler started",
		zap.Int("intervals", jobCount),
		zap.Int("symbols", len(bcs.predefinedSymbols)),
	)

	return nil
}

func (bcs *BullishCronScheduler) registerInterval(interval, schedule string) {
	intervalCopy := interval
	bcs.cron.AddFunc(schedule, func() {
		bcs.runAnalysis(intervalCopy)
	})

	bcs.logger.Info("Scheduled bullish analysis",
		zap.String("interval", interval),
		zap.String("schedule", schedule),
	)
}

func (bcs *BullishCronScheduler) runAnalysis(interval string) {
	bcs.logger.Info("Starting bullish analysis",
		zap.String("interval", interval),
		zap.Strings("symbols", bcs.GetSymbols()),
	)

	ctx, cancel := bcs.CreateAnalysisContext()
	defer cancel()

	startDate, endDate := bcs.CalculateDateRange()

	processFunc := func(ctx context.Context, symbol string) (*analysis.AnalysisResult, error) {
		query, err := bcs.CreateMarketDataQuery(symbol, startDate, endDate, interval)
		if err != nil {
			return nil, fmt.Errorf("failed to create query: %w", err)
		}
		return bcs.analyzer.Execute(ctx, query)
	}

	results, _ := bcs.ProcessSymbolsConcurrently(ctx, bcs.GetSymbols(), processFunc)
	bcs.logSummary(interval, results)
}

func (bcs *BullishCronScheduler) logSummary(interval string, results map[string]*analysis.AnalysisResult) {
	var bullishCount int
	var bullishSymbols []string

	for symbol, result := range results {
		if result.HasDivergence() && result.DivergenceType == analysis.BullishDivergence {
			bullishCount++
			bullishSymbols = append(bullishSymbols, symbol)

			bcs.logger.Info("Bullish divergence detected",
				zap.String("interval", interval),
				zap.String("symbol", symbol),
				zap.String("description", result.Description),
			)

			bcs.HandleResult(interval, symbol, result)
		}
	}

	bcs.logger.Info("Analysis complete",
		zap.String("interval", interval),
		zap.Int("analyzed", len(results)),
		zap.Int("signals", bullishCount),
		zap.Strings("bullish_symbols", bullishSymbols),
	)
}
