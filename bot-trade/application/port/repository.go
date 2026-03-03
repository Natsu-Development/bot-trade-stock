package port

import (
	"context"
	"time"

	"bot-trade/domain/aggregate/config"
	"bot-trade/domain/aggregate/stockmetrics"
)

// ConfigRepository defines the interface for TradingConfig persistence.
type ConfigRepository interface {
	// Create inserts a new configuration document.
	// ID must be pre-generated and set on config.
	Create(ctx context.Context, cfg *config.TradingConfig) error

	// GetByID retrieves configuration by its unique ID.
	// Returns config.ErrConfigNotFound if document does not exist.
	GetByID(ctx context.Context, id string) (*config.TradingConfig, error)

	// GetAll retrieves all configuration documents.
	GetAll(ctx context.Context) ([]*config.TradingConfig, error)

	// Update replaces an existing configuration document.
	// Returns config.ErrConfigNotFound if document does not exist.
	Update(ctx context.Context, cfg *config.TradingConfig) error

	// Delete removes a configuration document by ID.
	// Returns config.ErrConfigNotFound if document does not exist.
	Delete(ctx context.Context, id string) error
}

// StockMetricsRepository defines the interface for stock metrics persistence.
type StockMetricsRepository interface {
	// Save persists the stock metrics to the database.
	// Replaces any existing metrics (upsert with latest).
	Save(ctx context.Context, metrics []*stockmetrics.StockMetrics, calculatedAt time.Time) error

	// LoadLatest retrieves the most recent stock metrics from the database.
	// Returns the metrics, the time they were calculated, and any error.
	// Returns empty slice and zero time if no metrics exist.
	LoadLatest(ctx context.Context) ([]*stockmetrics.StockMetrics, time.Time, error)
}
