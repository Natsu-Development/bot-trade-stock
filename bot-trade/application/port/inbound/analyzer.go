// Package inbound defines primary (driving) port interfaces.
// These represent what the application offers to the outside world.
// Implemented by use cases, consumed by presentation handlers and schedulers.
package inbound

import (
	"context"

	"bot-trade/domain/aggregate/market"
)

// Analyzer defines the interface for unified analysis use cases.
// Combines bullish divergence, bearish divergence, and trendline signals
// into a single analysis, reducing redundant API calls.
type Analyzer interface {
	Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*market.CombinedAnalysisResult, error)
}
