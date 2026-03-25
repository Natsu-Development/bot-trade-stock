package wire

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"bot-trade/config"
	infraHTTP "bot-trade/infrastructure/http"
	"bot-trade/infrastructure/mongodb"
	"bot-trade/infrastructure/provider"
	providerRegistry "bot-trade/infrastructure/provider/registry"
	"bot-trade/pkg/logger"

	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"
)

// Infra holds all infrastructure layer dependencies.
type Infra struct {
	DB           *mongo.Client
	HTTPClient   *http.Client
	ProviderPool *provider.ProviderPool
}

// NewInfra initializes all infrastructure layer dependencies.
func NewInfra(cfg *config.InfraConfig) (*Infra, error) {
	// Logger - set as global so zap.L() works everywhere
	appLogger, err := logger.SetGlobal(logger.Config{
		Level:       cfg.LogLevel,
		Environment: cfg.Environment,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create logger: %w", err)
	}
	appLogger.Info("Initializing infrastructure layer")

	// MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoClient, err := mongodb.ConnectMongoDB(ctx, cfg.MongoDBURI, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}
	appLogger.Info("Connected to MongoDB", zap.String("database", cfg.MongoDBDatabase))

	// HTTP Client with retry
	httpClient := infraHTTP.NewHTTPClientWithRetry(30 * time.Second)

	// Provider Pool (market data gateway)
	providerPool := buildProviderPool(httpClient, cfg)

	return &Infra{
		DB:           mongoClient,
		HTTPClient:   httpClient,
		ProviderPool: providerPool,
	}, nil
}

// Close releases all infrastructure resources.
func (i *Infra) Close() {
	if i.DB != nil {
		i.DB.Disconnect(context.Background())
	}
	// Sync the global logger
	_ = zap.L().Sync()
}

// buildProviderPool creates a provider pool from all registered providers.
func buildProviderPool(
	httpClient *http.Client,
	cfg *config.InfraConfig,
) *provider.ProviderPool {
	var wrapped []*provider.WrappedProvider
	initialRPS := float64(cfg.DefaultProviderRPS)

	// Auto-discover all registered providers via factory registry
	for name, factory := range providerRegistry.GlobalRegistry().AllFactories() {
		p := factory(httpClient)
		limiter := provider.NewRateLimiter(initialRPS)
		wrapped = append(wrapped, provider.NewWrappedProvider(p, limiter))

		zap.L().Info("Provider registered",
			zap.String("name", name),
			zap.Float64("initial_rps", initialRPS),
		)
	}

	if len(wrapped) == 0 {
		zap.L().Warn("No providers registered")
		return nil
	}

	pool, err := provider.NewProviderPool(wrapped, cfg.PrimaryProvider)
	if err != nil {
		zap.L().Error("Failed to create provider pool", zap.Error(err))
		return nil
	}

	return pool
}
