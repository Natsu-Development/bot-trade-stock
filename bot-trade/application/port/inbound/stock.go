package inbound

import (
	"context"
	"errors"
	"time"

	"bot-trade/application/dto"
	filtervo "bot-trade/domain/shared/valueobject/filter"
)

// ErrCacheNotReady is returned when the stock metrics cache has not been populated yet.
var ErrCacheNotReady = errors.New("stock metrics cache not ready, call Refresh first")

// StockMetricsManager defines the primary port for stock metrics operations.
// Implemented by StockMetricsUseCase, consumed by presentation handlers.
type StockMetricsManager interface {
	Refresh(ctx context.Context) (*dto.StockMetricsResult, error)
	Filter(ctx context.Context, filter *filtervo.StockFilter) (*dto.StockMetricsResult, error)
	GetCacheInfo() (cachedAt time.Time, totalStocks int, ok bool)
}
