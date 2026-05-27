package wire

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"bot-trade/config"
	"bot-trade/infrastructure/credentials"
	infraHTTP "bot-trade/infrastructure/http"
	"bot-trade/infrastructure/metrics"
	"bot-trade/infrastructure/mongodb"
	"bot-trade/infrastructure/provider"
	providerRegistry "bot-trade/infrastructure/provider/registry"
	"bot-trade/pkg/logger"

	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"
)

// Infra holds all infrastructure layer dependencies.
type Infra struct {
	DB              *mongo.Client
	HTTPClient      *http.Client
	ProviderPool    *provider.ProviderPool
	ProviderMetrics *metrics.ProviderMetrics
	CredStore       *credentials.EnvCredentialStore
}

// NewInfra initializes all infrastructure layer dependencies.
func NewInfra(cfg *config.InfraConfig) (*Infra, error) {
	appLogger, err := logger.SetGlobal(logger.Config{
		Level:       cfg.LogLevel,
		Environment: cfg.Environment,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create logger: %w", err)
	}
	appLogger.Info("Initializing infrastructure layer")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoClient, err := mongodb.ConnectMongoDB(ctx, cfg.MongoDBURI, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}
	appLogger.Info("Connected to MongoDB", zap.String("database", cfg.MongoDBDatabase))

	httpClient := infraHTTP.NewHTTPClientWithRetry(60 * time.Second)
	providerMetrics := metrics.NewProviderMetrics()
	providerPool := buildProviderPool(httpClient, cfg, providerMetrics)

	// SSI credentials are only loaded + fail-fast verified in production, where the
	// quote API sits behind a Cloudflare challenge. Non-production deliberately
	// leaves CredStore nil so dev startup does not instantiate cookie-refresh code.
	var credStore *credentials.EnvCredentialStore
	if cfg.Environment == "production" {
		credStore, err = credentials.NewEnvCredentialStore(cfg.SSICredentialsEnvPath)
		if err != nil {
			return nil, fmt.Errorf("init credential store: %w", err)
		}
	} else {
		appLogger.Info("SSI credentials disabled (non-production); no credential store loaded")
	}

	return &Infra{
		DB:              mongoClient,
		HTTPClient:      httpClient,
		ProviderPool:    providerPool,
		ProviderMetrics: providerMetrics,
		CredStore:       credStore,
	}, nil
}

// Close releases all infrastructure resources.
func (i *Infra) Close() {
	if i.DB != nil {
		i.DB.Disconnect(context.Background())
	}
	_ = zap.L().Sync()
}

func buildProviderPool(
	httpClient *http.Client,
	cfg *config.InfraConfig,
	providerMetrics *metrics.ProviderMetrics,
) *provider.ProviderPool {
	var wrapped []*provider.WrappedProvider
	initialRPS := float64(cfg.DefaultProviderRPS)
	maxRPS := float64(cfg.MaxProviderRPS)

	for name, factory := range providerRegistry.GlobalRegistry().AllFactories() {
		p := factory(httpClient)
		bucket := provider.NewTokenBucket(name, initialRPS, maxRPS)
		wrapped = append(wrapped, provider.NewWrappedProvider(p, bucket, providerMetrics))

		zap.L().Info("Provider registered",
			zap.String("name", name),
			zap.Float64("initial_rps", initialRPS),
			zap.Float64("max_rps", maxRPS),
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
