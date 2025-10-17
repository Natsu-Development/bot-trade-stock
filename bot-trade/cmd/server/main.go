package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	appServices "bot-trade/internal/application/services"
	"bot-trade/internal/application/usecases"
	"bot-trade/internal/config"
	"bot-trade/internal/domain/repositories"
	"bot-trade/internal/domain/services"
	grpcClient "bot-trade/internal/infrastructure/grpc"
	grpcRepo "bot-trade/internal/infrastructure/repositories"
	httpRoutes "bot-trade/internal/presentation/http"
	"bot-trade/internal/presentation/http/handlers"
	"bot-trade/pkg/logger"

	"go.uber.org/zap"
	"google.golang.org/grpc"
)

func main() {
	// Initialize logger
	appLogger, err := logger.NewWithDefaults()
	if err != nil {
		log.Fatal("Failed to initialize logger:", err)
	}
	defer appLogger.Sync()

	// Set global logger
	logger.SetGlobal(appLogger)

	zap.L().Info("🚀 Starting High-Performance gRPC Trading Bot with Clean Architecture")

	// Load configuration from environment variables and .env file
	cfg, err := config.LoadFromEnv()
	if err != nil {
		zap.L().Fatal("Failed to load configuration", zap.Error(err))
	}

	// Initialize application with dependency injection
	app, err := initializeApplication(cfg)
	if err != nil {
		zap.L().Fatal("Failed to initialize application", zap.Error(err))
	}
	defer app.Close()

	// Auto-start bearish cron scheduler if enabled
	if cfg.BearishCronAutoStart {
		if err := app.BearishCronScheduler.Start(); err != nil {
			zap.L().Error("Failed to auto-start bearish cron scheduler", zap.Error(err))
		} else {
			zap.L().Info("✅ Bearish cron scheduler auto-started")
		}
	}

	// Auto-start bullish cron scheduler if enabled
	if cfg.BullishCronAutoStart {
		if err := app.BullishCronScheduler.Start(); err != nil {
			zap.L().Error("Failed to auto-start bullish cron scheduler", zap.Error(err))
		} else {
			zap.L().Info("✅ Bullish cron scheduler auto-started")
		}
	}

	// Setup HTTP router
	routerConfig := &httpRoutes.RouterConfig{
		GRPCServerAddr: cfg.GRPCServerAddr,
	}
	router := httpRoutes.NewRouter(app.BullishDivergenceHandler, app.BearishDivergenceHandler, app.CronHandler, routerConfig)

	// Print startup information
	printStartupInfo(cfg.GRPCServerAddr, cfg.HTTPPort)

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup graceful shutdown
	setupGracefulShutdown(app.BearishCronScheduler, app.BullishCronScheduler, cancel)

	// Create HTTP server with timeouts from config
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.HTTPReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.HTTPWriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(cfg.HTTPIdleTimeout) * time.Second,
	}

	// Start HTTP server in a goroutine
	go func() {
		zap.L().Info("Starting HTTP server", zap.Int("port", cfg.HTTPPort))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zap.L().Fatal("Failed to start HTTP server", zap.Error(err))
		}
	}()

	// Wait for shutdown signal
	<-ctx.Done()

	// Graceful shutdown with timeout from config
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), time.Duration(cfg.HTTPShutdownTimeout)*time.Second)
	defer shutdownCancel()

	zap.L().Info("🛑 Shutting down HTTP server gracefully...")
	if err := server.Shutdown(shutdownCtx); err != nil {
		zap.L().Error("Error during server shutdown", zap.Error(err))
	} else {
		zap.L().Info("✅ HTTP server stopped gracefully")
	}
}

// Application holds all initialized dependencies
type Application struct {
	// Infrastructure
	GRPCConn   *grpc.ClientConn
	Repository repositories.MarketDataRepository

	// Domain Services
	RSICalculator             *services.RSICalculatorService
	PivotDetector             *services.PivotDetectorService
	BearishDivergenceDetector *services.BearishDivergenceDetectorService
	BullishDivergenceDetector *services.BullishDivergenceDetectorService

	// Application Services
	BearishCronScheduler *appServices.BearishCronScheduler
	BullishCronScheduler *appServices.BullishCronScheduler

	// Use Cases
	AnalyzeBullishDivergenceUseCase *usecases.AnalyzeBullishDivergenceUseCase
	AnalyzeBearishDivergenceUseCase *usecases.AnalyzeBearishDivergenceUseCase

	// Handlers
	BullishDivergenceHandler *handlers.BullishDivergenceHandler
	BearishDivergenceHandler *handlers.BearishDivergenceHandler
	CronHandler              *handlers.CronHandler
}

// Close cleans up application resources
func (app *Application) Close() {
	if app.GRPCConn != nil {
		app.GRPCConn.Close()
	}
}

// initializeApplication initializes the application with all dependencies
func initializeApplication(cfg *config.Config) (*Application, error) {
	zap.L().Info("🔧 Initializing application dependencies")

	// Initialize gRPC connection with config
	zap.L().Info("📡 Connecting to gRPC server", zap.String("address", cfg.GRPCServerAddr))
	grpcConn, err := grpcClient.NewConnectionWithConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to gRPC server: %w", err)
	}
	zap.L().Info("✅ Connected to gRPC server")

	// Initialize repository
	marketDataRepo := grpcRepo.NewGRPCMarketDataRepository(grpcConn)

	// Initialize domain services with config values
	zap.L().Info("🏗️  Initializing domain services")
	rsiCalculator := services.NewRSICalculatorService(cfg.RSIPeriod)
	pivotDetector := services.NewPivotDetectorService(cfg)
	bearishDivergenceDetector := services.NewBearishDivergenceDetectorService(pivotDetector)
	bullishDivergenceDetector := services.NewBullishDivergenceDetectorService(pivotDetector)

	// Initialize use cases
	zap.L().Info("📋 Initializing application use cases")
	analyzeBullishDivergenceUseCase := usecases.NewAnalyzeBullishDivergenceUseCase(
		marketDataRepo,
		rsiCalculator,
		bullishDivergenceDetector,
		cfg.DivergenceIndicesRecent,
	)

	analyzeBearishDivergenceUseCase := usecases.NewAnalyzeBearishDivergenceUseCase(
		marketDataRepo,
		rsiCalculator,
		bearishDivergenceDetector,
		cfg.DivergenceIndicesRecent,
	)

	// Initialize application services
	zap.L().Info("⚙️  Initializing application services")
	bearishCronScheduler := appServices.NewBearishCronScheduler(zap.L(), analyzeBearishDivergenceUseCase, cfg)
	bullishCronScheduler := appServices.NewBullishCronScheduler(zap.L(), analyzeBullishDivergenceUseCase, cfg)

	// Initialize handlers
	zap.L().Info("🌐 Initializing HTTP handlers")
	bullishDivergenceHandler := handlers.NewBullishDivergenceHandler(analyzeBullishDivergenceUseCase)
	bearishDivergenceHandler := handlers.NewBearishDivergenceHandler(analyzeBearishDivergenceUseCase)
	cronHandler := handlers.NewCronHandler(bearishCronScheduler, bullishCronScheduler)

	zap.L().Info("✅ Application initialization complete")

	return &Application{
		GRPCConn:                        grpcConn,
		Repository:                      marketDataRepo,
		RSICalculator:                   rsiCalculator,
		PivotDetector:                   pivotDetector,
		BearishDivergenceDetector:       bearishDivergenceDetector,
		BullishDivergenceDetector:       bullishDivergenceDetector,
		BearishCronScheduler:            bearishCronScheduler,
		BullishCronScheduler:            bullishCronScheduler,
		AnalyzeBullishDivergenceUseCase: analyzeBullishDivergenceUseCase,
		AnalyzeBearishDivergenceUseCase: analyzeBearishDivergenceUseCase,
		BullishDivergenceHandler:        bullishDivergenceHandler,
		BearishDivergenceHandler:        bearishDivergenceHandler,
		CronHandler:                     cronHandler,
	}, nil
}

// setupGracefulShutdown sets up graceful shutdown handling
func setupGracefulShutdown(bearishCronScheduler *appServices.BearishCronScheduler, bullishCronScheduler *appServices.BullishCronScheduler, cancel context.CancelFunc) {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		zap.L().Info("🛑 Received shutdown signal, shutting down gracefully...")
		// Stop bearish cron scheduler gracefully
		if bearishCronScheduler.IsRunning() {
			bearishCronScheduler.Stop()
			zap.L().Info("✅ Bearish cron scheduler stopped gracefully")
		}
		// Stop bullish cron scheduler gracefully
		if bullishCronScheduler.IsRunning() {
			bullishCronScheduler.Stop()
			zap.L().Info("✅ Bullish cron scheduler stopped gracefully")
		}
		// Cancel context to trigger graceful shutdown
		cancel()
	}()
}

// printStartupInfo prints application startup information
func printStartupInfo(grpcServerAddr string, httpPort int) {
	fmt.Printf("\n💡 Example usage:\n")
	fmt.Printf("  curl http://localhost:%d/analyze/VIC/divergence/bullish\n", httpPort)
	fmt.Printf("  curl http://localhost:%d/analyze/VIC/divergence/bearish\n", httpPort)
	fmt.Printf("  curl 'http://localhost:%d/analyze/VIC/divergence/bullish?start_date=2024-01-01&end_date=2024-12-31&interval=1d'\n", httpPort)

	fmt.Printf("\n📡 gRPC Server: %s\n", grpcServerAddr)
	fmt.Printf("🌐 HTTP Server: %d\n", httpPort)
	fmt.Println("🚀 Ready to serve requests!")
}
