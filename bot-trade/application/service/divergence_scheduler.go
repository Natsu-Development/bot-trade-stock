package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	"bot-trade/domain/aggregate/analysis"
	tradingConfig "bot-trade/domain/aggregate/config"
	"bot-trade/domain/aggregate/market"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

const (
	analysisContextTimeout = 10 * time.Minute
	maxConcurrentAnalysis  = 5
)

// DivergenceScheduler handles automated divergence analysis for a single divergence type.
type DivergenceScheduler struct {
	scheduler        outbound.JobScheduler
	logger           *zap.Logger
	notifier         outbound.Notifier
	configRepository outbound.ConfigRepository
	analyzer         inbound.DivergenceAnalyzer
	divergenceType   analysis.DivergenceType
	intervals        map[string]outbound.IntervalConfig

	isRunning bool
	mu        sync.RWMutex
}

// NewDivergenceScheduler creates a scheduler for the given divergence type.
func NewDivergenceScheduler(
	scheduler outbound.JobScheduler,
	logger *zap.Logger,
	notifier outbound.Notifier,
	configRepository outbound.ConfigRepository,
	analyzer inbound.DivergenceAnalyzer,
	divergenceType analysis.DivergenceType,
	intervals map[string]outbound.IntervalConfig,
) *DivergenceScheduler {
	return &DivergenceScheduler{
		scheduler:        scheduler,
		logger:           logger,
		notifier:         notifier,
		configRepository: configRepository,
		analyzer:         analyzer,
		divergenceType:   divergenceType,
		intervals:        intervals,
	}
}

// Start registers all enabled intervals and starts the scheduler.
func (s *DivergenceScheduler) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return fmt.Errorf("%s scheduler already running", s.divergenceType)
	}

	jobCount := 0
	for interval, cfg := range s.intervals {
		if !cfg.Enabled || cfg.Schedule == "" {
			continue
		}

		intervalCopy := interval
		if err := s.scheduler.AddJob(cfg.Schedule, func() {
			s.runAnalysis(intervalCopy)
		}); err != nil {
			return fmt.Errorf("failed to register %s job for interval %s: %w", s.divergenceType, interval, err)
		}

		s.logger.Info("Scheduled analysis",
			zap.String("type", s.divergenceType.String()),
			zap.String("interval", interval),
			zap.String("schedule", cfg.Schedule),
		)
		jobCount++
	}

	if jobCount == 0 {
		return fmt.Errorf("no intervals enabled for %s scheduler", s.divergenceType)
	}

	s.scheduler.Start()
	s.isRunning = true
	s.logger.Info("Scheduler started",
		zap.String("type", s.divergenceType.String()),
		zap.Int("intervals", jobCount),
	)
	return nil
}

// Stop stops the scheduler.
func (s *DivergenceScheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		s.scheduler.Stop()
		s.isRunning = false
		s.logger.Info("Cron scheduler stopped", zap.String("type", s.divergenceType.String()))
	}
}

// IsRunning returns whether the scheduler is running.
func (s *DivergenceScheduler) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isRunning
}

func (s *DivergenceScheduler) runAnalysis(interval string) {
	ctx, cancel := context.WithTimeout(context.Background(), analysisContextTimeout)
	defer cancel()

	configs, err := s.configRepository.GetAll(ctx)
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
		endDate := time.Now().Format("2006-01-02")
		startDate := time.Now().AddDate(0, 0, -cfg.StartDateOffset).Format("2006-01-02")
		s.processConfig(ctx, interval, startDate, endDate, cfg)
	}
}

func (s *DivergenceScheduler) selectSymbols(cfg *tradingConfig.TradingConfig) []string {
	if s.divergenceType == analysis.BullishDivergence {
		return cfg.BullishSymbols
	}
	return cfg.BearishSymbols
}

type symbolResult struct {
	symbol string
	result *analysis.AnalysisResult
}

func (s *DivergenceScheduler) processConfig(ctx context.Context, interval, startDate, endDate string, cfg *tradingConfig.TradingConfig) {
	symbols := s.selectSymbols(cfg)
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

	var (
		mu      sync.Mutex
		results []symbolResult
	)

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(maxConcurrentAnalysis)

	for _, sym := range symbols {
		symbol := sym
		g.Go(func() error {
			query, err := market.NewMarketDataQueryFromStrings(symbol, startDate, endDate, interval)
			if err != nil {
				s.logger.Error("Failed to create query",
					zap.String("symbol", symbol),
					zap.Error(err),
				)
				return nil
			}

			result, err := s.analyzer.Execute(gctx, query, cfg.ID)
			if err != nil {
				s.logger.Error("Analysis failed",
					zap.String("symbol", symbol),
					zap.Error(err),
				)
				return nil
			}

			mu.Lock()
			results = append(results, symbolResult{symbol: symbol, result: result})
			mu.Unlock()
			return nil
		})
	}

	_ = g.Wait()
	s.handleResults(interval, results, cfg)
}

func (s *DivergenceScheduler) handleResults(interval string, results []symbolResult, cfg *tradingConfig.TradingConfig) {
	var signalCount, earlySignalCount int
	var signalSymbols, earlySymbols []string

	isBearish := s.divergenceType == analysis.BearishDivergence
	earlyEnabled := isBearish && cfg.EarlyDetectionEnabled != nil && *cfg.EarlyDetectionEnabled

	for _, sr := range results {
		symbol, result := sr.symbol, sr.result

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
			s.sendNotification(interval, symbol, result, cfg)
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
			s.sendEarlySignalNotification(interval, symbol, result, cfg)
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

func (s *DivergenceScheduler) sendNotification(interval, symbol string, result *analysis.AnalysisResult, cfg *tradingConfig.TradingConfig) {
	if s.notifier == nil || !cfg.Telegram.Enabled {
		return
	}
	if err := s.notifier.HandleDivergenceResult(
		s.divergenceType, interval, symbol, result,
		cfg.Telegram.BotToken, cfg.Telegram.ChatID,
	); err != nil {
		s.logger.Error("Failed to send notification",
			zap.String("type", s.divergenceType.String()),
			zap.String("symbol", symbol),
			zap.String("interval", interval),
			zap.Error(err),
		)
	}
}

func (s *DivergenceScheduler) sendEarlySignalNotification(interval, symbol string, result *analysis.AnalysisResult, cfg *tradingConfig.TradingConfig) {
	if s.notifier == nil || !cfg.Telegram.Enabled {
		return
	}
	if err := s.notifier.HandleEarlySignalResult(
		interval, symbol, result,
		cfg.Telegram.BotToken, cfg.Telegram.ChatID,
	); err != nil {
		s.logger.Error("Failed to send early signal notification",
			zap.String("symbol", symbol),
			zap.String("interval", interval),
			zap.Error(err),
		)
	}
}
