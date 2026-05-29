package wire

import (
	"context"
	"fmt"
	"time"

	_ "backend/application/jobs"
	jobsRegistry "backend/application/jobs/registry"
	"backend/application/port/outbound"
	appService "backend/application/service"
	"backend/application/usecase"
	appAnalyze "backend/application/usecase/analyze"
	appPrep "backend/application/usecase/analyze/prep"
	appRsi "backend/application/usecase/analyze/rsi"
	appTrendline "backend/application/usecase/analyze/trendline"
	"backend/config"
	alertservice "backend/domain/config/service"
	infraCron "backend/infrastructure/cron"
	"backend/infrastructure/mongodb"
	"backend/infrastructure/provider/sources"
	"backend/infrastructure/telegram"

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

	// SSI iboard-query adapter for real-time quotes (alert job). Observed via
	// ProviderMetrics under {provider="ssi-quote"} but NOT joined to the pool.
	quoteProvider, err := sources.NewSSIQueryProvider(infra.HTTPClient, infra.ProviderMetrics, infra.CredStore)
	if err != nil {
		return nil, fmt.Errorf("init ssi-quote provider: %w", err)
	}

	// Stateless domain service that owns alert fire/no-fire + value formatting.
	alertEvaluator := alertservice.NewAlertEvaluator()

	// Shared scoped-write seam used by both the tick alert job and the analyze jobs
	// to auto-disable fired conditions without whole-doc clobber.
	conditionDisabler := appService.NewConditionDisabler(configRepo)

	// Use Cases
	configUC := usecase.NewConfigUseCase(configRepo)
	stockMetricsUC := usecase.NewStockMetricsUseCase(gateway, stockMetricsRepo, configRepo, cfg.StockRefresh.Concurrency)

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
	loc, err := time.LoadLocation(cfg.CronTimezone)
	if err != nil {
		zap.L().Warn("Invalid cron timezone, using UTC", zap.String("timezone", cfg.CronTimezone), zap.Error(err))
		loc = time.UTC
	}
	cronAdapter := infraCron.NewAdapter(loc)
	scheduler := appService.NewJobScheduler(cronAdapter)

	// Build job dependencies. MarketTimezone re-uses the cron-scheduler's
	// loaded *time.Location so the binary has a single source of truth for
	// "what is Vietnam time?" — consumed by StockAlertJob's HoSE session gate
	// (see backend/domain/shared/valueobject/market/session.go).
	jobDeps := jobsRegistry.JobDependencies{
		Preparer:            dataPreparer,
		BullishRSIUC:        bullishRSIUC,
		BearishRSIUC:        bearishRSIUC,
		BreakoutUC:          breakoutUC,
		BreakdownUC:         breakdownUC,
		StockMetricsManager: stockMetricsUC,
		Notifier:            notifier,
		ConfigRepo:          configRepo,
		QuoteProvider:       quoteProvider,
		AlertEvaluator:      alertEvaluator,
		ConditionDisabler:   conditionDisabler,
		Config:              cfg,
		MarketTimezone:      loc,
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
