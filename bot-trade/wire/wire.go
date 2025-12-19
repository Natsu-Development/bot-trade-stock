// Package wire provides dependency injection and application wiring.
package wire

import (
	"context"
	"fmt"
	"net/http"
	"time"

	appPort "bot-trade/application/port"
	appService "bot-trade/application/service"
	"bot-trade/application/usecase"
	"bot-trade/config"
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/infrastructure/adapter"
	infraGRPC "bot-trade/infrastructure/grpc"
	"bot-trade/infrastructure/mongodb"
	"bot-trade/infrastructure/telegram"
	"bot-trade/pkg/logger"
	presHTTP "bot-trade/presentation/http"
	presHandler "bot-trade/presentation/http/handler"

	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

// App holds all initialized dependencies and manages application lifecycle.
type App struct {
	cfg    *config.InfraConfig
	logger *zap.Logger

	grpcConn         *grpc.ClientConn
	mongoClient      *mongo.Client
	bearishScheduler appPort.CronScheduler
	bullishScheduler appPort.CronScheduler
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

	// Connect to MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoClient, err := mongodb.ConnectMongoDB(ctx, cfg.MongoDBURI, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}
	appLogger.Info("Connected to MongoDB", zap.String("database", cfg.MongoDBDatabase))

	// Connect to gRPC
	grpcConn, err := newGRPCConnection(cfg)
	if err != nil {
		mongoClient.Disconnect(context.Background())
		return nil, fmt.Errorf("failed to connect to gRPC: %w", err)
	}

	// Create repositories
	configRepository := mongodb.NewConfigRepository(mongoClient, cfg.MongoDBDatabase)

	// Create infrastructure adapters
	notifier := telegram.NewNotifier()
	marketDataGateway := adapter.NewMarketDataGateway(grpcConn)

	// Create use cases
	bullishAnalyzer := usecase.NewAnalyzeDivergenceUseCase(
		configRepository, marketDataGateway, analysis.BullishDivergence, appLogger,
	)
	bearishAnalyzer := usecase.NewAnalyzeDivergenceUseCase(
		configRepository, marketDataGateway, analysis.BearishDivergence, appLogger,
	)
	configUseCase := usecase.NewConfigUseCase(configRepository)

	// Create schedulers
	bullishScheduler := appService.NewBullishCronScheduler(
		appLogger, notifier, configRepository, bullishAnalyzer,
		cfg.BullishCronStartDateOffset, cfg.BullishIntervals(),
	)
	bearishScheduler := appService.NewBearishCronScheduler(
		appLogger, notifier, configRepository, bearishAnalyzer,
		cfg.BearishCronStartDateOffset, cfg.BearishIntervals(),
	)

	// Create handlers
	configHandler := presHandler.NewConfigHandler(configUseCase)

	// Create router
	router := presHTTP.NewRouter(
		presHandler.NewBullishDivergenceHandler(bullishAnalyzer),
		presHandler.NewBearishDivergenceHandler(bearishAnalyzer),
		configHandler,
	)

	appLogger.Info("Application initialized successfully")

	return &App{
		cfg:              cfg,
		logger:           appLogger,
		grpcConn:         grpcConn,
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
	if a.grpcConn != nil {
		a.grpcConn.Close()
	}
	if a.mongoClient != nil {
		a.mongoClient.Disconnect(context.Background())
	}
	a.logger.Sync()
}

func newGRPCConnection(cfg *config.InfraConfig) (*grpc.ClientConn, error) {
	clientConfig := infraGRPC.NewClientConfig(
		cfg.GRPCServerAddr,
		time.Duration(cfg.GRPCConnectionTimeout)*time.Second,
		time.Duration(cfg.GRPCRequestTimeout)*time.Second,
	)
	return infraGRPC.NewConnection(clientConfig)
}
