package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"bot-trade/application/dto"
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	analysisvo "bot-trade/domain/analysis/valueobject"
	configagg "bot-trade/domain/config/aggregate"
	marketvo "bot-trade/domain/shared/valueobject/market"
	"bot-trade/infrastructure/formatter"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

const (
	analysisContextTimeout = 10 * time.Minute
	maxConcurrentAnalysis  = 5
)

// DivergenceScheduler handles automated divergence analysis for a single divergence type.
// Uses the unified Analyzer interface and extracts relevant results from AnalysisSession.
type DivergenceScheduler struct {
	scheduler        outbound.JobScheduler
	logger           *zap.Logger
	notifier         outbound.Notifier
	configRepository outbound.ConfigRepository
	analyzer         inbound.Analyzer
	divergenceType   analysisvo.DivergenceType
	intervals        map[string]outbound.IntervalConfig
	divFormatter     *formatter.DivergenceFormatter

	isRunning bool
	mu        sync.RWMutex
}

// NewDivergenceScheduler creates a scheduler for the given divergence type.
func NewDivergenceScheduler(
	scheduler outbound.JobScheduler,
	logger *zap.Logger,
	notifier outbound.Notifier,
	configRepository outbound.ConfigRepository,
	analyzer inbound.Analyzer,
	divergenceType analysisvo.DivergenceType,
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
		divFormatter:     formatter.NewDivergenceFormatter(),
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
			zap.String("type", string(s.divergenceType)),
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
		zap.String("type", string(s.divergenceType)),
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
		s.logger.Info("Cron scheduler stopped", zap.String("type", string(s.divergenceType)))
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
			zap.String("type", string(s.divergenceType)),
		)
		return
	}

	s.logger.Info("Starting analysis for all configs",
		zap.String("type", string(s.divergenceType)),
		zap.String("interval", interval),
		zap.Int("configCount", len(configs)),
	)

	for _, cfg := range configs {
		s.processConfig(ctx, interval, cfg)
	}
}

func (s *DivergenceScheduler) selectSymbols(cfg *configagg.TradingConfig) []string {
	var symbols []marketvo.Symbol
	if s.divergenceType.IsBullish() {
		symbols = cfg.BullishSymbols
	} else {
		symbols = cfg.BearishSymbols
	}

	// Convert []sharedvo.Symbol to []strings
	result := make([]string, len(symbols))
	for i, sym := range symbols {
		result[i] = string(sym)
	}
	return result
}

type symbolSession struct {
	symbol string
	result *dto.AnalysisResult
}

func (s *DivergenceScheduler) processConfig(ctx context.Context, interval string, cfg *configagg.TradingConfig) {
	symbols := s.selectSymbols(cfg)
	if len(symbols) == 0 {
		s.logger.Debug("Skipping config with no symbols",
			zap.String("type", string(s.divergenceType)),
			zap.String("configID", string(cfg.ID)),
		)
		return
	}

	s.logger.Info("Processing config",
		zap.String("type", string(s.divergenceType)),
		zap.String("configID", string(cfg.ID)),
		zap.String("interval", interval),
		zap.Strings("symbols", symbols),
	)

	var (
		mu       sync.Mutex
		sessions []symbolSession
	)

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(maxConcurrentAnalysis)

	for _, symbol := range symbols {
		symbol := symbol
		g.Go(func() error {
			query, err := marketvo.NewMarketDataQueryFromStrings(symbol, "", interval, cfg.LookbackDay)
			if err != nil {
				s.logger.Error("Failed to create query",
					zap.String("symbol", symbol),
					zap.Error(err),
				)
				return nil
			}

			result, err := s.analyzer.Execute(gctx, query, string(cfg.ID))
			if err != nil {
				s.logger.Error("Analysis failed",
					zap.String("symbol", symbol),
					zap.Error(err),
				)
				return nil
			}

			mu.Lock()
			sessions = append(sessions, symbolSession{symbol: symbol, result: result})
			mu.Unlock()
			return nil
		})
	}

	_ = g.Wait()
	s.handleResults(interval, sessions, cfg)
}

func (s *DivergenceScheduler) handleResults(interval string, sessions []symbolSession, cfg *configagg.TradingConfig) {
	var signalCount, earlySignalCount int
	var signalSymbols, earlySymbols []string

	isBearish := s.divergenceType.IsBearish()
	earlyEnabled := isBearish && cfg.BearishEarly != nil && *cfg.BearishEarly

	for _, ss := range sessions {
		symbol, result := ss.symbol, ss.result

		// Check for divergence of the scheduler's type
		hasDivergence := hasDivergenceOfType(result.Divergences, s.divergenceType)

		// Check for early signal (bearish only)
		hasEarlySignal := false
		var earlyDesc string
		if earlyEnabled && len(result.PriceHistory) > 0 {
			// currentData := result.PriceHistory[len(result.PriceHistory)-1]
			// earlyDiv, detected := analysisservice.FindEarlyBearishDivergence(result.RSIPivots, currentData)
			// if detected && !hasDivergence {
			// 	hasEarlySignal = true
			// 	earlyDesc = formatter.NewDivergenceFormatter().FormatDetection(earlyDiv)
			// }
		}

		if hasDivergence {
			signalCount++
			signalSymbols = append(signalSymbols, symbol)
			s.logger.Info("Divergence detected",
				zap.String("type", string(s.divergenceType)),
				zap.String("configID", string(cfg.ID)),
				zap.String("interval", interval),
				zap.String("symbol", symbol),
			)
			s.sendNotification(interval, symbol, result, cfg)
		}

		if hasEarlySignal {
			earlySignalCount++
			earlySymbols = append(earlySymbols, symbol)
			s.logger.Info("Early signal detected",
				zap.String("type", string(s.divergenceType)),
				zap.String("configID", string(cfg.ID)),
				zap.String("interval", interval),
				zap.String("symbol", symbol),
				zap.String("description", earlyDesc),
			)
			s.sendEarlySignalNotification(interval, symbol, earlyDesc, cfg)
		}
	}

	logFields := []zap.Field{
		zap.String("type", string(s.divergenceType)),
		zap.String("configID", string(cfg.ID)),
		zap.String("interval", interval),
		zap.Int("analyzed", len(sessions)),
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

// sendNotification sends a notification for detected divergence.
func (s *DivergenceScheduler) sendNotification(interval, symbol string, result *dto.AnalysisResult, cfg *configagg.TradingConfig) {
	// Find divergences of the scheduler's type
	divergences := filterDivergencesByType(result.Divergences, s.divergenceType)
	if len(divergences) == 0 {
		return
	}

	div := divergences[0] // Use first (most recent)
	description := formatDivergenceDescription(div)

	req := outbound.NotificationRequest{
		Type:           outbound.NotificationTypeDivergence,
		DivergenceType: s.divergenceType,
		Interval:       interval,
		Symbol:         symbol,
		Result:         result,
		Description:    description,
		IsEarlySignal:  false,
		TelegramCfg:    cfg.Telegram,
	}
	if err := s.notifier.SendNotification(req); err != nil {
		s.logger.Error("Failed to send notification",
			zap.String("type", string(s.divergenceType)),
			zap.String("symbol", symbol),
			zap.String("interval", interval),
			zap.Error(err),
		)
	}
}

// hasDivergenceOfType checks if there are divergences of the specified type.
func hasDivergenceOfType(divergences []dto.DivergenceDTO, divType analysisvo.DivergenceType) bool {
	for _, div := range divergences {
		if div.Type == string(divType) {
			return true
		}
	}
	return false
}

// filterDivergencesByType returns divergences matching the specified type.
func filterDivergencesByType(divergences []dto.DivergenceDTO, divType analysisvo.DivergenceType) []dto.DivergenceDTO {
	result := make([]dto.DivergenceDTO, 0)
	for _, div := range divergences {
		if div.Type == string(divType) {
			result = append(result, div)
		}
	}
	return result
}

// formatDivergenceDescription formats a divergence DTO for notifications.
func formatDivergenceDescription(div dto.DivergenceDTO) string {
	return fmt.Sprintf("%s divergence detected between %s and %s",
		div.Type, div.Points[0].Date, div.Points[1].Date)
}

// sendEarlySignalNotification sends a notification for early divergence signal.
func (s *DivergenceScheduler) sendEarlySignalNotification(interval, symbol, description string, cfg *configagg.TradingConfig) {
	req := outbound.NotificationRequest{
		Type:           outbound.NotificationTypeEarlySignal,
		DivergenceType: s.divergenceType,
		Interval:       interval,
		Symbol:         symbol,
		Result:         nil, // No analysis result for early signals
		Description:    description,
		IsEarlySignal:  true,
		TelegramCfg:    cfg.Telegram,
	}
	if err := s.notifier.SendNotification(req); err != nil {
		s.logger.Error("Failed to send early signal notification",
			zap.String("symbol", symbol),
			zap.String("interval", interval),
			zap.Error(err),
		)
	}
}
