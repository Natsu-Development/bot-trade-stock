package services

import (
	"context"
	"fmt"

	"bot-trade/internal/application/dto"
	"bot-trade/internal/application/usecases"
	"bot-trade/internal/config"

	"go.uber.org/zap"
)

// BearishCronScheduler handles automated bearish divergence analysis
type BearishCronScheduler struct {
	*BaseCronScheduler
	analyzeUseCase *usecases.AnalyzeBearishDivergenceUseCase
}

// NewBearishCronScheduler creates a new bearish cron scheduler
func NewBearishCronScheduler(
	logger *zap.Logger,
	analyzeUseCase *usecases.AnalyzeBearishDivergenceUseCase,
	cfg *config.Config,
) *BearishCronScheduler {
	return &BearishCronScheduler{
		BaseCronScheduler: NewBaseCronScheduler(logger, cfg, "Bearish"),
		analyzeUseCase:    analyzeUseCase,
	}
}

// Start starts the bearish cron scheduler for all enabled intervals
func (bcs *BearishCronScheduler) Start() error {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()

	if bcs.isRunning {
		return fmt.Errorf("bearish scheduler already running")
	}

	jobCount := 0

	// Register each enabled interval
	if bcs.config.Bearish30mEnabled && bcs.config.Bearish30mSchedule != "" {
		bcs.registerInterval("30m", bcs.config.Bearish30mSchedule)
		jobCount++
	}

	if bcs.config.Bearish1HEnabled && bcs.config.Bearish1HSchedule != "" {
		bcs.registerInterval("1H", bcs.config.Bearish1HSchedule)
		jobCount++
	}

	if bcs.config.Bearish1DEnabled && bcs.config.Bearish1DSchedule != "" {
		bcs.registerInterval("1D", bcs.config.Bearish1DSchedule)
		jobCount++
	}

	if bcs.config.Bearish1WEnabled && bcs.config.Bearish1WSchedule != "" {
		bcs.registerInterval("1W", bcs.config.Bearish1WSchedule)
		jobCount++
	}

	if jobCount == 0 {
		return fmt.Errorf("no intervals enabled")
	}

	bcs.cron.Start()
	bcs.isRunning = true

	bcs.logger.Info("🚀 Bearish scheduler started",
		zap.Int("intervals", jobCount),
		zap.Int("symbols", len(bcs.predefinedSymbols)),
	)

	return nil
}

// registerInterval registers a cron job for a specific interval
func (bcs *BearishCronScheduler) registerInterval(interval, schedule string) {
	bcs.cron.AddFunc(schedule, func() {
		bcs.runAnalysis(interval)
	})

	bcs.logger.Info("📅 Scheduled bearish analysis",
		zap.String("interval", interval),
		zap.String("schedule", schedule),
	)
}

// runAnalysis executes bearish divergence analysis
func (bcs *BearishCronScheduler) runAnalysis(interval string) {
	bcs.logger.Info("🔍 Starting bearish analysis",
		zap.String("interval", interval),
		zap.Strings("symbols", bcs.GetSymbols()),
	)

	ctx, cancel := bcs.CreateAnalysisContext()
	defer cancel()

	startDate, endDate := bcs.CalculateDateRange(bcs.config.BearishCronStartDateOffset)

	processFunc := func(ctx context.Context, symbol string) (*dto.DivergenceAnalysisResponse, error) {
		request := bcs.CreateAnalysisRequest(symbol, startDate, endDate, interval)
		return bcs.analyzeUseCase.Execute(ctx, request)
	}

	results, _ := bcs.ProcessSymbolsConcurrently(ctx, bcs.GetSymbols(), processFunc)

	bcs.logSummary(interval, results)
}

// logSummary logs and notifies analysis results
func (bcs *BearishCronScheduler) logSummary(interval string, results map[string]*dto.DivergenceAnalysisResponse) {
	var bearishCount int
	var bearishSymbols []string

	for symbol, response := range results {
		if response.Divergence != nil && response.Divergence.DivergenceFound && response.Divergence.Type == "bearish" {
			bearishCount++
			bearishSymbols = append(bearishSymbols, symbol)

			bcs.logger.Info("📊 Bearish divergence detected",
				zap.String("interval", interval),
				zap.String("symbol", symbol),
				zap.String("description", response.Divergence.Description),
			)

			// Send Telegram notification
			bcs.NotifyTelegram("Bearish", interval, symbol, response.Divergence.Description)
		}
	}

	bcs.logger.Info("📈 Analysis complete",
		zap.String("interval", interval),
		zap.Int("analyzed", len(results)),
		zap.Int("signals", bearishCount),
		zap.Strings("bearish_symbols", bearishSymbols),
	)
}
