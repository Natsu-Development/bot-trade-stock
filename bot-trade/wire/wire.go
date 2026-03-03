// Package wire provides dependency injection and application wiring.
package wire

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"bot-trade/application/port/inbound"
	appService "bot-trade/application/service"
	"bot-trade/application/usecase"
	"bot-trade/config"
	"bot-trade/domain/aggregate/analysis"
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
	cfg    *config.InfraConfig
	logger *zap.Logger

	mongoClient      *mongo.Client
	bearishScheduler inbound.CronScheduler
	bullishScheduler inbound.CronScheduler
	router           http.Handler
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

	bullishAnalyzer := usecase.NewAnalyzeDivergenceUseCase(
		configRepository, marketDataGateway, analysis.BullishDivergence, appLogger,
	)
	bearishAnalyzer := usecase.NewAnalyzeDivergenceUseCase(
		configRepository, marketDataGateway, analysis.BearishDivergence, appLogger,
	)
	configUseCase := usecase.NewConfigUseCase(configRepository)
	stockMetricsUseCase := usecase.NewStockMetricsUseCase(marketDataGateway, stockMetricsRepository, appLogger)
	trendlineAnalyzer := usecase.NewAnalyzeTrendlineUseCase(
		configRepository, marketDataGateway, appLogger,
	)
	unifiedAnalyzer := usecase.NewAnalyzeUseCase(
		configRepository, marketDataGateway, bullishAnalyzer, bearishAnalyzer, trendlineAnalyzer, appLogger,
	)

	loadCtx, loadCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer loadCancel()
	if _, err := stockMetricsUseCase.LoadFromDB(loadCtx); err != nil {
		appLogger.Warn("Failed to load stock metrics from database on startup", zap.Error(err))
	}

	bullishScheduler := appService.NewDivergenceScheduler(
		infraCron.NewJobScheduler(),
		appLogger, notifier, configRepository, bullishAnalyzer,
		analysis.BullishDivergence, cfg.BullishIntervals(),
	)
	bearishScheduler := appService.NewDivergenceScheduler(
		infraCron.NewJobScheduler(),
		appLogger, notifier, configRepository, bearishAnalyzer,
		analysis.BearishDivergence, cfg.BearishIntervals(),
	)

	configHandler := presHandler.NewConfigHandler(configUseCase)
	stockHandler := presHandler.NewStockHandler(stockMetricsUseCase)
	analyzeHandler := presHandler.NewAnalyzeHandler(unifiedAnalyzer, appLogger)

	router := presHTTP.NewRouter(
		configHandler,
		stockHandler,
		analyzeHandler,
	)

	appLogger.Info("Application initialized successfully")

	return &App{
		cfg:              cfg,
		logger:           appLogger,
		mongoClient:      mongoClient,
		bearishScheduler: bearishScheduler,
		bullishScheduler: bullishScheduler,
		router:           router,
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
	if a.cfg.BullishCronAutoStart {
		if err := a.bullishScheduler.Start(); err != nil {
			a.logger.Error("Failed to start bullish scheduler", zap.Error(err))
		} else {
			a.logger.Info("Bullish scheduler started")
		}
	}

	if a.cfg.BearishCronAutoStart {
		if err := a.bearishScheduler.Start(); err != nil {
			a.logger.Error("Failed to start bearish scheduler", zap.Error(err))
		} else {
			a.logger.Info("Bearish scheduler started")
		}
	}
}

// StopSchedulers stops running schedulers.
func (a *App) StopSchedulers() {
	if a.bullishScheduler.IsRunning() {
		a.bullishScheduler.Stop()
		a.logger.Info("Bullish scheduler stopped")
	}
	if a.bearishScheduler.IsRunning() {
		a.bearishScheduler.Stop()
		a.logger.Info("Bearish scheduler stopped")
	}
}

// Close releases all application resources.
func (a *App) Close() {
	a.StopSchedulers()
	if a.mongoClient != nil {
		a.mongoClient.Disconnect(context.Background())
	}
	a.logger.Sync()
}
