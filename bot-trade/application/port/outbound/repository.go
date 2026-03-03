// Package outbound defines secondary (driven) port interfaces.
// These represent what the application needs from external systems.
// Implemented by infrastructure adapters, consumed by use cases and services.
package outbound

import (
	"context"
	"time"

	"bot-trade/domain/aggregate/config"
	"bot-trade/domain/aggregate/stockmetrics"
)

// ConfigRepository defines the interface for TradingConfig persistence.
type ConfigRepository interface {
	Create(ctx context.Context, cfg *config.TradingConfig) error
	GetByID(ctx context.Context, id string) (*config.TradingConfig, error)
	GetAll(ctx context.Context) ([]*config.TradingConfig, error)
	Update(ctx context.Context, cfg *config.TradingConfig) error
	Delete(ctx context.Context, id string) error
}

// StockMetricsRepository defines the interface for stock metrics persistence.
type StockMetricsRepository interface {
	Save(ctx context.Context, metrics []*stockmetrics.StockMetrics, calculatedAt time.Time) error
	LoadLatest(ctx context.Context) ([]*stockmetrics.StockMetrics, time.Time, error)
}
