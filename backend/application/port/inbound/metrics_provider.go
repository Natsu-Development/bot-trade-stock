package inbound

import (
	"context"
	"errors"
	"time"

	"backend/application/dto"
	filtervo "backend/domain/shared/valueobject/filter"
)

// ErrCacheNotReady is returned when the stock metrics cache has not been populated yet.
var ErrCacheNotReady = errors.New("stock metrics cache not ready, call Refresh first")

// StockMetricsManager defines the primary port for stock metrics operations.
// Implemented by the metrics UseCase, consumed by presentation handlers and jobs.
type StockMetricsManager interface {
	Refresh(ctx context.Context) (*dto.StockMetricsResult, error)
	// Filter returns the cached metrics matching filter for the given config: it resolves
	// the per-config signals (lazily cached over the snapshot bars), applies the filter,
	// and splices the flags onto each returned stock (the shared snapshot is never
	// mutated). Unknown configID → ErrConfigNotFound; unpopulated cache → ErrCacheNotReady;
	// a nil/empty filter returns the full screener view.
	Filter(ctx context.Context, filter *filtervo.StockFilter, configID string) (*dto.StockMetricsResult, error)
	// Recompute refreshes BOTH per-config caches for configID from the cached snapshot
	// bars (no sweep): the screener signal cache AND the watchlist alert-trendline cache.
	// It returns only the cache stamp + ranked size (mirroring GetCacheInfo). Backs POST
	// /stocks/recompute. Unknown configID → ErrConfigNotFound; unpopulated → ErrCacheNotReady.
	Recompute(ctx context.Context, configID string) (cachedAt time.Time, totalStocks int, err error)
	GetCacheInfo() (cachedAt time.Time, totalStocks int, ok bool)
}
