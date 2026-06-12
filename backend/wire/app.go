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
	"backend/application/usecase/metrics"
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
	StockMetrics *metrics.UseCase
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
	stockBarsRepo := mongodb.NewStockBarsRepository(infra.DB, cfg.MongoDBDatabase, "stock_bars")

	// Gateway (provider pool implements MarketDataGateway)
	var gateway outbound.MarketGateway
	if infra.ProviderPool != nil {
		gateway = infra.ProviderPool
	}

	// Notifier
	notifier := telegram.NewNotifier()

	// SSI iboard-query adapter for real-time quotes (watchlist job). Observed via
	// ProviderMetrics under {provider="ssi-quote"} but NOT joined to the pool.
	quoteProvider, err := sources.NewSSIQueryProvider(infra.HTTPClient, infra.ProviderMetrics, infra.CredStore)
	if err != nil {
		return nil, fmt.Errorf("init ssi-quote provider: %w", err)
	}

	// Stateless domain service that owns watchlist fire/no-fire + value formatting.
	alertEvaluator := alertservice.NewWatchlistEvaluator()

	// Shared scoped-write seam used by both the tick watchlist job and the analyze jobs
	// to auto-disable fired conditions without whole-doc clobber.
	conditionDisabler := appService.NewConditionDisabler(configRepo)

	// Lock-free per-config alert-level store: written by the refresh/Layer-2 path
	// (eager publish + fresh-on-edit), read by the 15s watchlist tick.
	trendlineStore := appService.NewAlertTrendlineStore()

	// Shared lock-free metrics snapshot: written by stockMetricsUC on each refresh,
	// read by the Layer-2 computes and the watchlist tick. Created here in the
	// composition root and injected into every consumer (no use-case getter).
	snapshotStore := appService.NewSnapshotStore()

	// Use Cases
	configUC := usecase.NewConfigUseCase(configRepo)

	// Layer-2 per-config compute, split by concern. Both read the SAME shared
	// snapshotStore (created above) as lock-free readers — the one instance
	// the base pipeline writes to on each refresh.
	//   - Compute: the screener's per-config SignalFlags (LRU-cached).
	//   - AlertCompute: the watchlist's per-config AlertTrendline, eager-published into
	//     trendlineStore after each refresh (via the metrics orchestrator's Refresh).
	signalComputeUC, err := metrics.NewSignalComputeUseCase(snapshotStore, configRepo, cfg.SignalsLRUSize)
	if err != nil {
		return nil, fmt.Errorf("init signal-compute use case: %w", err)
	}
	alertComputeUC := metrics.NewAlertComputeUseCase(snapshotStore, configRepo, trendlineStore)

	// Metrics orchestrator: Refresh runs the Layer-1 base pipeline then eagerly
	// recomputes per-config alert trendlines. Bound as the StockMetricsManager so
	// BOTH the refresh job and the HTTP handler route through it — alert recompute
	// stays covered for every refresh driver.
	metricsUC := metrics.NewStockMetricsUseCase(
		gateway, stockMetricsRepo, stockBarsRepo, configRepo,
		cfg.StockRefresh.Concurrency, cfg.AnalysisWindowBars, snapshotStore,
		signalComputeUC, alertComputeUC,
	)
	// Fresh-on-edit: a config save recomputes that config's per-config alert levels
	// immediately (the 15s watchlist tick reads the level store directly, so it can't
	// lazily recompute). The screener signal cache needs no explicit bust — its
	// UpdatedAt-stamped LRU self-invalidates on the next Compute.
	configUC.AddConfigChangeListener(metricsUC)

	// Load cached data on startup
	loadCtx, loadCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer loadCancel()
	if _, err := metricsUC.LoadFromDB(loadCtx); err != nil {
		zap.L().Warn("Failed to load stock metrics from database on startup", zap.Error(err))
	}
	// Alert levels are RAM-only (no persistence) and there is no boot sweep: they stay
	// empty until the first daily cron refresh's eager publish recomputes them. The
	// watchlist tick treats empty levels as "no fire", so this is safe.

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
	// "what is Vietnam time?" — consumed by WatchlistJob's HoSE session gate
	// (see backend/domain/shared/valueobject/market/session.go).
	jobDeps := jobsRegistry.JobDependencies{
		Preparer:            dataPreparer,
		BullishRSIUC:        bullishRSIUC,
		BearishRSIUC:        bearishRSIUC,
		BreakoutUC:          breakoutUC,
		BreakdownUC:         breakdownUC,
		StockMetricsManager: metricsUC,
		Notifier:            notifier,
		ConfigRepo:          configRepo,
		QuoteProvider:       quoteProvider,
		WatchlistEvaluator:  alertEvaluator,
		ConditionDisabler:   conditionDisabler,
		Config:              cfg,
		MarketTimezone:      loc,
		SnapshotStore:       snapshotStore,
		AlertTrendlineStore: trendlineStore,
	}

	// Register all jobs via factories. The stock-refresh job runs on its daily cron
	// only (no boot sweep) — a fresh deploy serves DB-rehydrated base metrics
	// (LoadFromDB) until the first cron refresh.
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
		StockMetrics: metricsUC,
		Analyzer:     analyzer,
		Scheduler:    scheduler,
	}, nil
}
