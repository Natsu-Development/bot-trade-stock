// Package wire provides dependency injection and application wiring.
package wire

import (
	"context"
	"fmt"
	"net/http"
	"time"

	appService "bot-trade/application/service"
	"bot-trade/application/usecase"
	appAnalyze "bot-trade/application/usecase/analyze"
	appPrep "bot-trade/application/usecase/analyze/prep"
	appRsi "bot-trade/application/usecase/analyze/rsi"
	appTrendline "bot-trade/application/usecase/analyze/trendline"
	"bot-trade/config"
	"bot-trade/infrastructure/adapter"
	infraCron "bot-trade/infrastructure/cron"
	infraHTTP "bot-trade/infrastructure/http"
	"bot-trade/infrastructure/mongodb"
	"bot-trade/infrastructure/telegram"
	"bot-trade/pkg/logger"
	presHTTP "bot-trade/presentation/http"
	presHandler "bot-trade/presentation/http/handler"

	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"
)

// App holds all initialized dependencies and manages application lifecycle.
type App struct {
	cfg       *config.InfraConfig
	logger    *zap.Logger
	scheduler *appService.JobScheduler

	mongoClient *mongo.Client
	router      http.Handler
}

// New creates and wires all application dependencies.
func New(cfg *config.InfraConfig) (*App, error) {
	appLogger, err := logger.New(logger.Config{
		Level:       cfg.LogLevel,
		Environment: cfg.Environment,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create logger: %w", err)
	}

	appLogger.Info("Initializing application")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoClient, err := mongodb.ConnectMongoDB(ctx, cfg.MongoDBURI, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}
	appLogger.Info("Connected to MongoDB", zap.String("database", cfg.MongoDBDatabase))

	configRepository := mongodb.NewConfigRepository(mongoClient, cfg.MongoDBDatabase, "bot_config")
	stockMetricsRepository := mongodb.NewStockMetricsRepository(mongoClient, cfg.MongoDBDatabase, "stock_metrics")

	httpClient := infraHTTP.NewHTTPClientWithRetry(30*time.Second, appLogger)

	notifier := telegram.NewNotifier()
	marketDataGateway := adapter.NewVietCapGateway(httpClient, cfg.VietCapRateLimit)
	appLogger.Info("VietCap gateway initialized",
		zap.Int("rate_limit_per_min", cfg.VietCapRateLimit),
		zap.String("retry_transport", "enabled"),
	)

	configUseCase := usecase.NewConfigUseCase(configRepository)
	stockMetricsUseCase := usecase.NewStockMetricsUseCase(marketDataGateway, stockMetricsRepository, appLogger)

	// Create shared DataPreparer (DRY - used by orchestrator and jobs)
	dataPreparer := appPrep.NewPreparer(configUseCase, marketDataGateway, appLogger)

	// Create specialized use cases for jobs (pure analysis, no I/O)
	bullishRSIUC := appRsi.NewBullishRSIUseCase(appLogger)
	bearishRSIUC := appRsi.NewBearishRSIUseCase(appLogger)

	// Create trendline use cases for jobs
	breakoutUC := appTrendline.NewBreakoutUseCase(appLogger)
	breakdownUC := appTrendline.NewBreakdownUseCase(appLogger)

	// Create the unified analyzer for API (composes specialized use cases)
	analyzer := appAnalyze.NewAnalyzer(
		configUseCase,
		marketDataGateway,
		appLogger,
	)

	loadCtx, loadCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer loadCancel()
	if _, err := stockMetricsUseCase.LoadFromDB(loadCtx); err != nil {
		appLogger.Warn("Failed to load stock metrics from database on startup", zap.Error(err))
	}

	// Create scheduler with cron adapter (Clean Architecture)
	cronAdapter := infraCron.NewAdapter(nil)
	scheduler := appService.NewJobScheduler(cronAdapter, appLogger)

	// Build job dependencies
	jobDeps := appService.JobDependencies{
		Analyzer:            analyzer,
		Preparer:            dataPreparer,
		BullishRSIUC:        bullishRSIUC,
		BearishRSIUC:        bearishRSIUC,
		BreakoutUC:          breakoutUC,
		BreakdownUC:         breakdownUC,
		StockMetricsManager: stockMetricsUseCase,
		Notifier:            notifier,
		ConfigRepo:          configRepository,
		Logger:              appLogger,
		Config:              cfg,
	}

	// Instantiate all registered jobs via factories
	for name, factory := range appService.GlobalRegistry().AllFactories() {
		jobs, err := factory(jobDeps)
		if err != nil {
			return nil, fmt.Errorf("create jobs from factory %s: %w", name, err)
		}
		if err := scheduler.RegisterAll(jobs); err != nil {
			return nil, fmt.Errorf("register jobs from factory %s: %w", name, err)
		}
	}

	configHandler := presHandler.NewConfigHandler(configUseCase)
	stockHandler := presHandler.NewStockHandler(stockMetricsUseCase)
	analyzeHandler := presHandler.NewAnalyzeHandler(analyzer, appLogger)

	router := presHTTP.NewRouter(
		configHandler,
		stockHandler,
		analyzeHandler,
	)

	appLogger.Info("Application initialized successfully")

	return &App{
		cfg:         cfg,
		logger:      appLogger,
		scheduler:   scheduler,
		mongoClient: mongoClient,
		router:      router,
	}, nil
}

// Logger returns the application logger.
func (a *App) Logger() *zap.Logger {
	return a.logger
}

// Router returns the HTTP router.
func (a *App) Router() http.Handler {
	return a.router
}

// StartSchedulers starts the cron schedulers based on configuration.
func (a *App) StartSchedulers() {
	if a.cfg.HasAnyAutoStart() {
		a.scheduler.Start()
		a.logger.Info("Job scheduler started")
	}
}

// StopSchedulers stops running schedulers.
func (a *App) StopSchedulers() {
	a.scheduler.Stop()
	a.logger.Info("Job scheduler stopped")
}

// Close releases all application resources.
func (a *App) Close() {
	a.StopSchedulers()
	if a.mongoClient != nil {
		a.mongoClient.Disconnect(context.Background())
	}
	a.logger.Sync()
}
