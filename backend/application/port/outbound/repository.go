// Package outbound defines secondary (driven) port interfaces.
// These represent what the application needs from external systems.
// Implemented by infrastructure adapters, consumed by use cases and services.
package outbound

import (
	"context"
	"time"

	configagg "backend/domain/config/aggregate"
	configvo "backend/domain/config/valueobject"
	metricsagg "backend/domain/metrics/aggregate"
	marketvo "backend/domain/shared/valueobject/market"
)

// ConfigRepository defines the interface for TradingConfig persistence.
type ConfigRepository interface {
	Create(ctx context.Context, cfg *configagg.TradingConfig) error
	GetByID(ctx context.Context, id string) (*configagg.TradingConfig, error)
	GetAll(ctx context.Context) ([]*configagg.TradingConfig, error)
	Update(ctx context.Context, cfg *configagg.TradingConfig) error
	Delete(ctx context.Context, id string) error
	// SetConditionEnabled scopes a single-condition enabled toggle to the matching
	// (symbol, type, reference) via an arrayFilter, avoiding whole-doc clobber when
	// multiple jobs disable different conditions in the same config concurrently.
	SetConditionEnabled(ctx context.Context, configID, symbol string, cond configvo.TriggerCondition, enabled bool) error
}

// StockMetricsRepository defines the interface for the computed base-metrics
// snapshot persistence. One refresh produces these ranked metrics; the raw OHLC
// bars that same refresh fetches (which Layer 2 recomputes per-config signals from)
// are persisted separately via StockBarsRepository — a different collection holding
// a different kind of data, split by concern.
type StockMetricsRepository interface {
	Save(ctx context.Context, metrics []*metricsagg.StockMetrics, calculatedAt time.Time) error
	LoadLatest(ctx context.Context) ([]*metricsagg.StockMetrics, time.Time, error)
}

// StockBarsRepository defines the interface for raw OHLC bar-series persistence. The
// bars are stored compressed and stamped with the SAME calculatedAt as the metrics
// snapshot from that refresh, so a boot rehydrate adopts them only when the two
// stamps match (otherwise signals stay empty until the next refresh).
type StockBarsRepository interface {
	// SaveBars persists the raw per-symbol bar series (compressed) stamped with the
	// refresh's calculatedAt. Best-effort: the caller logs and continues on error
	// rather than failing the refresh.
	SaveBars(ctx context.Context, bars map[string][]marketvo.MarketData, calculatedAt time.Time) error
	// LoadBars returns the persisted bars and their stamp, or (nil, zero, nil) when
	// none exist. A decode/codec error is returned so the caller can fall back to
	// no-bars rather than booting with a corrupt series.
	LoadBars(ctx context.Context) (map[string][]marketvo.MarketData, time.Time, error)
}
