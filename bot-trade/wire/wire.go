// Package wire provides dependency injection and application wiring.
package wire

import (
	"fmt"
	"net/http"
	"time"

	appPort "bot-trade/application/port"
	appService "bot-trade/application/service"
	"bot-trade/application/usecase"
	"bot-trade/config"
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/service/divergence"
	"bot-trade/infrastructure/adapter"
	infraGRPC "bot-trade/infrastructure/grpc"
	"bot-trade/infrastructure/telegram"
	"bot-trade/pkg/logger"
	presHTTP "bot-trade/presentation/http"
	presHandler "bot-trade/presentation/http/handler"

	"go.uber.org/zap"
	"google.golang.org/grpc"
)

// App holds all initialized dependencies and manages application lifecycle.
type App struct {
	cfg    *config.Config
	logger *zap.Logger

	grpcConn         *grpc.ClientConn
	bearishScheduler appPort.CronScheduler
	bullishScheduler appPort.CronScheduler
	router           http.Handler
}

// New creates and wires all application dependencies.
func New(cfg *config.Config) (*App, error) {
	appLogger, err := logger.New(logger.Config{
		Level:       cfg.LogLevel,
		Environment: cfg.Environment,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create logger: %w", err)
	}

	appLogger.Info("Initializing application")

	grpcConn, err := newGRPCConnection(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to gRPC: %w", err)
	}

	notifier := telegram.NewNotifier(cfg.TelegramBotToken, cfg.TelegramChatID, cfg.TelegramEnabled)
	marketDataGateway := adapter.NewMarketDataGateway(grpcConn)

	divergenceDetector, err := newDivergenceDetector(cfg)
	if err != nil {
		grpcConn.Close()
		return nil, fmt.Errorf("failed to create divergence detector: %w", err)
	}

	bullishAnalyzer := usecase.NewAnalyzeDivergenceUseCase(
		marketDataGateway, divergenceDetector, analysis.BullishDivergence,
		appLogger, cfg.DivergenceIndicesRecent, cfg.RSIPeriod,
	)
	bearishAnalyzer := usecase.NewAnalyzeDivergenceUseCase(
		marketDataGateway, divergenceDetector, analysis.BearishDivergence,
		appLogger, cfg.DivergenceIndicesRecent, cfg.RSIPeriod,
	)

	bullishScheduler := appService.NewBullishCronScheduler(
		appLogger, notifier, bullishAnalyzer, cfg.DefaultSymbols,
		cfg.BullishCronStartDateOffset, cfg.BullishIntervals(),
	)
	bearishScheduler := appService.NewBearishCronScheduler(
		appLogger, notifier, bearishAnalyzer, cfg.DefaultSymbols,
		cfg.BearishCronStartDateOffset, cfg.BearishIntervals(),
	)

	router := presHTTP.NewRouter(
		presHandler.NewBullishDivergenceHandler(bullishAnalyzer),
		presHandler.NewBearishDivergenceHandler(bearishAnalyzer),
	)

	appLogger.Info("Application initialized successfully")

	return &App{
		cfg:              cfg,
		logger:           appLogger,
		grpcConn:         grpcConn,
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
	a.logger.Sync()
}

func newGRPCConnection(cfg *config.Config) (*grpc.ClientConn, error) {
	clientConfig := infraGRPC.NewClientConfig(
		cfg.GRPCServerAddr,
		time.Duration(cfg.GRPCConnectionTimeout)*time.Second,
		time.Duration(cfg.GRPCRequestTimeout)*time.Second,
	)
	return infraGRPC.NewConnection(clientConfig)
}

func newDivergenceDetector(cfg *config.Config) (*divergence.Detector, error) {
	config, err := divergence.NewConfig(
		cfg.DivergenceLookbackLeft,
		cfg.DivergenceLookbackRight,
		cfg.DivergenceRangeMin,
		cfg.DivergenceRangeMax,
	)
	if err != nil {
		return nil, err
	}

	return divergence.NewDetector(config), nil
}
