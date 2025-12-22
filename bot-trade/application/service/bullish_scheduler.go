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
	configRepository infraPort.ConfigRepository,
	analyzer appPort.DivergenceAnalyzer,
	intervals map[string]config.IntervalConfig,
) *BullishCronScheduler {
	return &BullishCronScheduler{
		BaseCronScheduler: NewBaseCronScheduler(
			logger, notifier, configRepository, analysis.BullishDivergence,
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

	bcs.logger.Info("Starting bullish analysis for all configs",
		zap.String("interval", interval),
		zap.Int("configCount", len(configs)),
	)

	// Process each config with its own date range
	for _, cfg := range configs {
		startDate, endDate := bcs.CalculateDateRange(cfg.StartDateOffset)
		bcs.processConfig(ctx, interval, startDate, endDate, cfg)
	}
}

func (bcs *BullishCronScheduler) processConfig(ctx context.Context, interval, startDate, endDate string, cfg *tradingConfig.TradingConfig) {
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

func (bcs *BullishCronScheduler) logSummary(interval string, results map[string]*analysis.AnalysisResult, cfg *tradingConfig.TradingConfig) {
	var bullishCount int
	var bullishSymbols []string

	for symbol, result := range results {
		if result.HasDivergence() && result.DivergenceType == analysis.BullishDivergence {
			bullishCount++
			bullishSymbols = append(bullishSymbols, symbol)

			bcs.logger.Info("Bullish divergence detected",
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
		zap.Int("signals", bullishCount),
		zap.Strings("bullish_symbols", bullishSymbols),
	)
}
