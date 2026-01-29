package port

import (
	"context"
	"time"

	"bot-trade/domain/aggregate/stockmetrics"
)

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
