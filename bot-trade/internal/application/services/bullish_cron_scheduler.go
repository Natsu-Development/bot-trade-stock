package services

import (
	"context"
	"fmt"

	"bot-trade/internal/application/dto"
	"bot-trade/internal/application/usecases"
	"bot-trade/internal/config"

	"go.uber.org/zap"
)

// BullishCronScheduler handles automated bullish divergence analysis
type BullishCronScheduler struct {
	*BaseCronScheduler
	analyzeUseCase *usecases.AnalyzeBullishDivergenceUseCase
}

// NewBullishCronScheduler creates a new bullish cron scheduler
func NewBullishCronScheduler(
	logger *zap.Logger,
	analyzeUseCase *usecases.AnalyzeBullishDivergenceUseCase,
	cfg *config.Config,
) *BullishCronScheduler {
	return &BullishCronScheduler{
		BaseCronScheduler: NewBaseCronScheduler(logger, cfg, "Bullish"),
		analyzeUseCase:    analyzeUseCase,
	}
}

// Start starts the bullish cron scheduler for all enabled intervals
func (bcs *BullishCronScheduler) Start() error {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()

	if bcs.isRunning {
		return fmt.Errorf("bullish scheduler already running")
	}

	jobCount := 0

	// Register each enabled interval
	if bcs.config.Bullish30mEnabled && bcs.config.Bullish30mSchedule != "" {
		bcs.registerInterval("30m", bcs.config.Bullish30mSchedule)
		jobCount++
	}

	if bcs.config.Bullish1HEnabled && bcs.config.Bullish1HSchedule != "" {
		bcs.registerInterval("1H", bcs.config.Bullish1HSchedule)
		jobCount++
	}

	if bcs.config.Bullish1DEnabled && bcs.config.Bullish1DSchedule != "" {
		bcs.registerInterval("1D", bcs.config.Bullish1DSchedule)
		jobCount++
	}

	if bcs.config.Bullish1WEnabled && bcs.config.Bullish1WSchedule != "" {
		bcs.registerInterval("1W", bcs.config.Bullish1WSchedule)
		jobCount++
	}

	if jobCount == 0 {
		return fmt.Errorf("no intervals enabled")
	}

	bcs.cron.Start()
	bcs.isRunning = true

	bcs.logger.Info("🚀 Bullish scheduler started",
		zap.Int("intervals", jobCount),
		zap.Int("symbols", len(bcs.predefinedSymbols)),
	)

	return nil
}

// registerInterval registers a cron job for a specific interval
func (bcs *BullishCronScheduler) registerInterval(interval, schedule string) {
	bcs.cron.AddFunc(schedule, func() {
		bcs.runAnalysis(interval)
	})

	bcs.logger.Info("📅 Scheduled bullish analysis",
		zap.String("interval", interval),
		zap.String("schedule", schedule),
	)
}

// runAnalysis executes bullish divergence analysis
func (bcs *BullishCronScheduler) runAnalysis(interval string) {
	bcs.logger.Info("🔍 Starting bullish analysis",
		zap.String("interval", interval),
		zap.Strings("symbols", bcs.GetSymbols()),
	)

	ctx, cancel := bcs.CreateAnalysisContext()
	defer cancel()

	startDate, endDate := bcs.CalculateDateRange(bcs.config.BullishCronStartDateOffset)

	processFunc := func(ctx context.Context, symbol string) (*dto.DivergenceAnalysisResponse, error) {
		request := bcs.CreateAnalysisRequest(symbol, startDate, endDate, interval)
		return bcs.analyzeUseCase.Execute(ctx, request)
	}

	results, _ := bcs.ProcessSymbolsConcurrently(ctx, bcs.GetSymbols(), processFunc)

	bcs.logSummary(interval, results)
}

// logSummary logs and notifies analysis results
func (bcs *BullishCronScheduler) logSummary(interval string, results map[string]*dto.DivergenceAnalysisResponse) {
	var bullishCount int
	var bullishSymbols []string

	for symbol, response := range results {
		if response.Divergence != nil && response.Divergence.DivergenceFound && response.Divergence.Type == "bullish" {
			bullishCount++
			bullishSymbols = append(bullishSymbols, symbol)

			bcs.logger.Info("📊 Bullish divergence detected",
				zap.String("interval", interval),
				zap.String("symbol", symbol),
				zap.String("description", response.Divergence.Description),
			)

			// Send Telegram notification
			bcs.NotifyTelegram("Bullish", interval, symbol, response.Divergence.Description)
		}
	}

	bcs.logger.Info("📈 Analysis complete",
		zap.String("interval", interval),
		zap.Int("analyzed", len(results)),
		zap.Int("signals", bullishCount),
		zap.Strings("bullish_symbols", bullishSymbols),
	)
}
