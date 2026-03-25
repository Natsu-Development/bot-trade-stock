// Package outbound defines secondary (driven) port interfaces.
// These represent what the application needs from external systems.
// Implemented by infrastructure adapters, consumed by use cases and services.
package outbound

import (
	"context"
	"time"

	configagg "bot-trade/domain/config/aggregate"
	metricsagg "bot-trade/domain/metrics/aggregate"
)

// ConfigRepository defines the interface for TradingConfig persistence.
type ConfigRepository interface {
	Create(ctx context.Context, cfg *configagg.TradingConfig) error
	GetByID(ctx context.Context, id string) (*configagg.TradingConfig, error)
	GetAll(ctx context.Context) ([]*configagg.TradingConfig, error)
	Update(ctx context.Context, cfg *configagg.TradingConfig) error
	Delete(ctx context.Context, id string) error
}

// StockMetricsRepository defines the interface for stock metrics persistence.
type StockMetricsRepository interface {
	Save(ctx context.Context, metrics []*metricsagg.StockMetrics, calculatedAt time.Time) error
	LoadLatest(ctx context.Context) ([]*metricsagg.StockMetrics, time.Time, error)
}
