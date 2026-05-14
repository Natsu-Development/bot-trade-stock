package inbound

import (
	"context"
	"errors"
	"time"

	"bot-trade/application/dto"
	metricsagg "bot-trade/domain/metrics/aggregate"
	filtervo "bot-trade/domain/shared/valueobject/filter"
)

// ErrCacheNotReady is returned when the stock metrics cache has not been populated yet.
var ErrCacheNotReady = errors.New("stock metrics cache not ready, call Refresh first")

// StockMetricsManager defines the primary port for stock metrics operations.
// Implemented by StockMetricsUseCase, consumed by presentation handlers and jobs.
type StockMetricsManager interface {
	Refresh(ctx context.Context) (*dto.StockMetricsResult, error)
	Filter(ctx context.Context, filter *filtervo.StockFilter) (*dto.StockMetricsResult, error)
	GetCacheInfo() (cachedAt time.Time, totalStocks int, ok bool)
	// MetricsBySymbol returns a shared, read-only symbol→metrics lookup map.
	// Returns nil before the cache is loaded. Hot-path consumers (jobs that
	// run frequently) should read this once per tick instead of calling
	// Filter — it's a single atomic load, no per-tick allocation.
	MetricsBySymbol() map[string]*metricsagg.StockMetrics
}
