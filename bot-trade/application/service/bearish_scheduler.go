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

// BearishCronScheduler handles automated bearish divergence analysis.
type BearishCronScheduler struct {
	*BaseCronScheduler
	analyzer  appPort.DivergenceAnalyzer
	intervals map[string]config.IntervalConfig
}

// NewBearishCronScheduler creates a new bearish cron scheduler.
func NewBearishCronScheduler(
	logger *zap.Logger,
	notifier infraPort.Notifier,
	analyzer appPort.DivergenceAnalyzer,
	symbols []string,
	startDateOffset int,
	intervals map[string]config.IntervalConfig,
) *BearishCronScheduler {
	return &BearishCronScheduler{
		BaseCronScheduler: NewBaseCronScheduler(
			logger, notifier, symbols, analysis.BearishDivergence, startDateOffset,
		),
		analyzer:  analyzer,
		intervals: intervals,
	}
}

// Start starts the bearish cron scheduler for all enabled intervals.
func (bcs *BearishCronScheduler) Start() error {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()

	if bcs.isRunning {
		return fmt.Errorf("bearish scheduler already running")
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

	bcs.logger.Info("Bearish scheduler started",
		zap.Int("intervals", jobCount),
		zap.Int("symbols", len(bcs.predefinedSymbols)),
	)

	return nil
}

func (bcs *BearishCronScheduler) registerInterval(interval, schedule string) {
	intervalCopy := interval
	bcs.cron.AddFunc(schedule, func() {
		bcs.runAnalysis(intervalCopy)
	})

	bcs.logger.Info("Scheduled bearish analysis",
		zap.String("interval", interval),
		zap.String("schedule", schedule),
	)
}

func (bcs *BearishCronScheduler) runAnalysis(interval string) {
	bcs.logger.Info("Starting bearish analysis",
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

func (bcs *BearishCronScheduler) logSummary(interval string, results map[string]*analysis.AnalysisResult) {
	var bearishCount int
	var bearishSymbols []string

	for symbol, result := range results {
		if result.HasDivergence() && result.DivergenceType == analysis.BearishDivergence {
			bearishCount++
			bearishSymbols = append(bearishSymbols, symbol)

			bcs.logger.Info("Bearish divergence detected",
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
		zap.Int("signals", bearishCount),
		zap.Strings("bearish_symbols", bearishSymbols),
	)
}
