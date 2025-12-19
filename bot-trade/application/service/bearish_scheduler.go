package service

import (
	"context"
	"fmt"

	appPort "bot-trade/application/port"
	"bot-trade/config"
	"bot-trade/domain/aggregate/analysis"
	tradingConfig "bot-trade/domain/aggregate/config"
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
	configRepository infraPort.ConfigRepository,
	analyzer appPort.DivergenceAnalyzer,
	startDateOffset int,
	intervals map[string]config.IntervalConfig,
) *BearishCronScheduler {
	return &BearishCronScheduler{
		BaseCronScheduler: NewBaseCronScheduler(
			logger, notifier, configRepository, analysis.BearishDivergence, startDateOffset,
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
	ctx, cancel := bcs.CreateAnalysisContext()
	defer cancel()

	// Load all trading configs from database
	configs, err := bcs.LoadAllConfigs(ctx)
	if err != nil {
		bcs.logger.Error("Failed to load trading configs", zap.Error(err))
		return
	}

	if len(configs) == 0 {
		bcs.logger.Warn("No trading configs found in database, skipping scheduled job")
		return
	}

	bcs.logger.Info("Starting bearish analysis for all configs",
		zap.String("interval", interval),
		zap.Int("configCount", len(configs)),
	)

	startDate, endDate := bcs.CalculateDateRange()

	// Process each config
	for _, cfg := range configs {
		bcs.processConfig(ctx, interval, startDate, endDate, cfg)
	}
}

func (bcs *BearishCronScheduler) processConfig(ctx context.Context, interval, startDate, endDate string, cfg *tradingConfig.TradingConfig) {
	bcs.logger.Info("Processing config",
		zap.String("configID", cfg.ID),
		zap.String("interval", interval),
		zap.Strings("symbols", cfg.Symbols),
	)

	processFunc := func(ctx context.Context, symbol string) (*analysis.AnalysisResult, error) {
		query, err := bcs.CreateMarketDataQuery(symbol, startDate, endDate, interval)
		if err != nil {
			return nil, fmt.Errorf("failed to create query: %w", err)
		}
		return bcs.analyzer.Execute(ctx, query, cfg.ID)
	}

	results, _ := bcs.ProcessSymbolsConcurrently(ctx, cfg.Symbols, processFunc)
	bcs.logSummary(interval, results, cfg)
}

func (bcs *BearishCronScheduler) logSummary(interval string, results map[string]*analysis.AnalysisResult, cfg *tradingConfig.TradingConfig) {
	var bearishCount int
	var bearishSymbols []string

	for symbol, result := range results {
		if result.HasDivergence() && result.DivergenceType == analysis.BearishDivergence {
			bearishCount++
			bearishSymbols = append(bearishSymbols, symbol)

			bcs.logger.Info("Bearish divergence detected",
				zap.String("configID", cfg.ID),
				zap.String("interval", interval),
				zap.String("symbol", symbol),
				zap.String("description", result.Description),
			)

			bcs.HandleResult(interval, symbol, result, cfg)
		}
	}

	bcs.logger.Info("Analysis complete for config",
		zap.String("configID", cfg.ID),
		zap.String("interval", interval),
		zap.Int("analyzed", len(results)),
		zap.Int("signals", bearishCount),
		zap.Strings("bearish_symbols", bearishSymbols),
	)
}
