package wire

import (
	"context"
	"fmt"
	"time"

	_ "bot-trade/application/jobs"
	jobsRegistry "bot-trade/application/jobs/registry"
	"bot-trade/application/port/outbound"
	appService "bot-trade/application/service"
	"bot-trade/application/usecase"
	appAnalyze "bot-trade/application/usecase/analyze"
	appPrep "bot-trade/application/usecase/analyze/prep"
	appRsi "bot-trade/application/usecase/analyze/rsi"
	appTrendline "bot-trade/application/usecase/analyze/trendline"
	"bot-trade/config"
	infraCron "bot-trade/infrastructure/cron"
	"bot-trade/infrastructure/mongodb"
	"bot-trade/infrastructure/telegram"

	"go.uber.org/zap"
)

// AppServices holds all application layer dependencies.
type AppServices struct {
	// Use Cases
	ConfigUC     *usecase.ConfigUseCase
	StockMetrics *usecase.StockMetricsUseCase
	Analyzer     *appAnalyze.AnalyzeUseCase

	// Scheduler
	Scheduler *appService.JobScheduler
}

// NewAppServices initializes all application layer dependencies.
func NewAppServices(cfg *config.InfraConfig, infra *Infra) (*AppServices, error) {
	zap.L().Info("Initializing application layer")

	// Repositories
	configRepo := mongodb.NewConfigRepository(infra.DB, cfg.MongoDBDatabase, "bot_config")
	stockMetricsRepo := mongodb.NewStockMetricsRepository(infra.DB, cfg.MongoDBDatabase, "stock_metrics")

	// Gateway (provider pool implements MarketDataGateway)
	var gateway outbound.MarketGateway
	if infra.ProviderPool != nil {
		gateway = infra.ProviderPool
	}

	// Notifier
	notifier := telegram.NewNotifier()

	// Use Cases
	configUC := usecase.NewConfigUseCase(configRepo)
	stockMetricsUC := usecase.NewStockMetricsUseCase(gateway, stockMetricsRepo, configRepo)

	// Load cached data on startup
	loadCtx, loadCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer loadCancel()
	if _, err := stockMetricsUC.LoadFromDB(loadCtx); err != nil {
		zap.L().Warn("Failed to load stock metrics from database on startup", zap.Error(err))
	}

	// Shared DataPreparer (DRY - used by orchestrator and jobs)
	dataPreparer := appPrep.NewPreparer(configUC, gateway)

	// Specialized use cases for jobs (pure analysis, no I/O)
	bullishRSIUC := appRsi.NewBullishRSIUseCase()
	bearishRSIUC := appRsi.NewBearishRSIUseCase()
	breakoutUC := appTrendline.NewBreakoutUseCase()
	breakdownUC := appTrendline.NewBreakdownUseCase()

	// Unified analyzer for API
	analyzer := appAnalyze.NewAnalyzer(configUC, gateway)

	// Scheduler with cron adapter
	cronAdapter := infraCron.NewAdapter(nil)
	scheduler := appService.NewJobScheduler(cronAdapter)

	// Build job dependencies
	jobDeps := jobsRegistry.JobDependencies{
		Preparer:            dataPreparer,
		BullishRSIUC:        bullishRSIUC,
		BearishRSIUC:        bearishRSIUC,
		BreakoutUC:          breakoutUC,
		BreakdownUC:         breakdownUC,
		StockMetricsManager: stockMetricsUC,
		Notifier:            notifier,
		ConfigRepo:          configRepo,
		Config:              cfg,
	}

	// Register all jobs via factories
	for name, factory := range jobsRegistry.GlobalRegistry().AllFactories() {
		jobs, err := factory(jobDeps)
		if err != nil {
			return nil, fmt.Errorf("create jobs from factory %s: %w", name, err)
		}
		if err := scheduler.RegisterAll(jobs); err != nil {
			return nil, fmt.Errorf("register jobs from factory %s: %w", name, err)
		}
	}

	return &AppServices{
		ConfigUC:     configUC,
		StockMetrics: stockMetricsUC,
		Analyzer:     analyzer,
		Scheduler:    scheduler,
	}, nil
}
