package service

import (
	"context"
	"fmt"

	appPort "bot-trade/application/port"
	"bot-trade/domain/aggregate/analysis"
	tradingConfig "bot-trade/domain/aggregate/config"

	"go.uber.org/zap"
)

// DivergenceScheduler handles automated divergence analysis for a single divergence type.
// It replaces the former BullishCronScheduler and BearishCronScheduler, which were
// structurally identical apart from which symbol list they read and the bearish-only
// early-signal notification path.
type DivergenceScheduler struct {
	*BaseCronScheduler
	analyzer        appPort.DivergenceAnalyzer
	intervals       map[string]IntervalConfig
	symbolsSelector func(*tradingConfig.TradingConfig) []string
}

// newDivergenceScheduler is the internal constructor used by the public factory functions.
func newDivergenceScheduler(
	logger *zap.Logger,
	notifier appPort.Notifier,
	configRepository appPort.ConfigRepository,
	analyzer appPort.DivergenceAnalyzer,
	divergenceType analysis.DivergenceType,
	intervals map[string]IntervalConfig,
) *DivergenceScheduler {
	symbolsSelector := func(cfg *tradingConfig.TradingConfig) []string {
		if divergenceType == analysis.BullishDivergence {
			return cfg.BullishSymbols
		}
		return cfg.BearishSymbols
	}
	return &DivergenceScheduler{
		BaseCronScheduler: NewBaseCronScheduler(logger, notifier, configRepository, divergenceType),
		analyzer:          analyzer,
		intervals:         intervals,
		symbolsSelector:   symbolsSelector,
	}
}

// NewBullishCronScheduler creates a scheduler for bullish divergence analysis.
func NewBullishCronScheduler(
	logger *zap.Logger,
	notifier appPort.Notifier,
	configRepository appPort.ConfigRepository,
	analyzer appPort.DivergenceAnalyzer,
	intervals map[string]IntervalConfig,
) *DivergenceScheduler {
	return newDivergenceScheduler(logger, notifier, configRepository, analyzer, analysis.BullishDivergence, intervals)
}

// NewBearishCronScheduler creates a scheduler for bearish divergence analysis.
func NewBearishCronScheduler(
	logger *zap.Logger,
	notifier appPort.Notifier,
	configRepository appPort.ConfigRepository,
	analyzer appPort.DivergenceAnalyzer,
	intervals map[string]IntervalConfig,
) *DivergenceScheduler {
	return newDivergenceScheduler(logger, notifier, configRepository, analyzer, analysis.BearishDivergence, intervals)
}

// Start starts the scheduler for all enabled intervals.
func (s *DivergenceScheduler) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return fmt.Errorf("%s scheduler already running", s.divergenceType)
	}

	jobCount := 0
	for interval, cfg := range s.intervals {
		if cfg.Enabled && cfg.Schedule != "" {
			s.registerInterval(interval, cfg.Schedule)
			jobCount++
		}
	}

	if jobCount == 0 {
		return fmt.Errorf("no intervals enabled for %s scheduler", s.divergenceType)
	}

	s.cron.Start()
	s.isRunning = true
	s.logger.Info("Scheduler started",
		zap.String("type", s.divergenceType.String()),
		zap.Int("intervals", jobCount),
	)
	return nil
}

func (s *DivergenceScheduler) registerInterval(interval, schedule string) {
	intervalCopy := interval
	s.cron.AddFunc(schedule, func() {
		s.runAnalysis(intervalCopy)
	})
	s.logger.Info("Scheduled analysis",
		zap.String("type", s.divergenceType.String()),
		zap.String("interval", interval),
		zap.String("schedule", schedule),
	)
}

func (s *DivergenceScheduler) runAnalysis(interval string) {
	ctx, cancel := s.CreateAnalysisContext()
	defer cancel()

	configs, err := s.LoadAllConfigs(ctx)
	if err != nil {
		s.logger.Error("Failed to load trading configs", zap.Error(err))
		return
	}

	if len(configs) == 0 {
		s.logger.Warn("No trading configs found, skipping scheduled job",
			zap.String("type", s.divergenceType.String()),
		)
		return
	}

	s.logger.Info("Starting analysis for all configs",
		zap.String("type", s.divergenceType.String()),
		zap.String("interval", interval),
		zap.Int("configCount", len(configs)),
	)

	for _, cfg := range configs {
		startDate, endDate := s.CalculateDateRange(cfg.StartDateOffset)
		s.processConfig(ctx, interval, startDate, endDate, cfg)
	}
}

func (s *DivergenceScheduler) processConfig(ctx context.Context, interval, startDate, endDate string, cfg *tradingConfig.TradingConfig) {
	symbols := s.symbolsSelector(cfg)
	if len(symbols) == 0 {
		s.logger.Debug("Skipping config with no symbols",
			zap.String("type", s.divergenceType.String()),
			zap.String("configID", cfg.ID),
		)
		return
	}

	s.logger.Info("Processing config",
		zap.String("type", s.divergenceType.String()),
		zap.String("configID", cfg.ID),
		zap.String("interval", interval),
		zap.Strings("symbols", symbols),
	)

	processFunc := func(ctx context.Context, symbol string) (*analysis.AnalysisResult, error) {
		query, err := s.CreateMarketDataQuery(symbol, startDate, endDate, interval)
		if err != nil {
			return nil, fmt.Errorf("failed to create query: %w", err)
		}
		return s.analyzer.Execute(ctx, query, cfg.ID)
	}

	results, _ := ProcessItemsConcurrently(ctx, symbols, processFunc, s.logger)
	s.logSummary(interval, results, cfg)
}

func (s *DivergenceScheduler) logSummary(interval string, results map[string]*analysis.AnalysisResult, cfg *tradingConfig.TradingConfig) {
	var signalCount, earlySignalCount int
	var signalSymbols, earlySymbols []string

	isBearish := s.divergenceType == analysis.BearishDivergence
	earlyEnabled := isBearish && cfg.EarlyDetectionEnabled != nil && *cfg.EarlyDetectionEnabled

	for symbol, result := range results {
		if result.HasDivergence() && result.DivergenceType == s.divergenceType {
			signalCount++
			signalSymbols = append(signalSymbols, symbol)
			s.logger.Info("Divergence detected",
				zap.String("type", s.divergenceType.String()),
				zap.String("configID", cfg.ID),
				zap.String("interval", interval),
				zap.String("symbol", symbol),
				zap.String("description", result.Description),
			)
			s.HandleResult(interval, symbol, result, cfg)
		}

		if earlyEnabled && result.HasEarlySignal() && !result.HasDivergence() {
			earlySignalCount++
			earlySymbols = append(earlySymbols, symbol)
			s.logger.Info("Early signal detected",
				zap.String("type", s.divergenceType.String()),
				zap.String("configID", cfg.ID),
				zap.String("interval", interval),
				zap.String("symbol", symbol),
				zap.String("description", result.EarlyDescription),
			)
			earlyResult := analysis.NewAnalysisResult(
				result.Symbol,
				analysis.BearishDivergence,
				true,
				result.CurrentPrice,
				result.CurrentRSI,
				result.EarlyDescription,
				result.ProcessingTimeMs,
				result.StartDate,
				result.EndDate,
				result.Interval,
				result.RSIPeriod,
			)
			s.HandleResult(interval, symbol, earlyResult, cfg)
		}
	}

	logFields := []zap.Field{
		zap.String("type", s.divergenceType.String()),
		zap.String("configID", cfg.ID),
		zap.String("interval", interval),
		zap.Int("analyzed", len(results)),
		zap.Int("signals", signalCount),
		zap.Strings("signal_symbols", signalSymbols),
	}
	if isBearish {
		logFields = append(logFields,
			zap.Int("early_signals", earlySignalCount),
			zap.Strings("early_signal_symbols", earlySymbols),
		)
	}
	s.logger.Info("Analysis complete for config", logFields...)
}
