// Package inbound defines primary (driving) port interfaces.
// These represent what the application offers to the outside world.
// Implemented by use cases, consumed by presentation handlers and schedulers.
package inbound

import (
	"context"

	"bot-trade/application/dto"
	"bot-trade/domain/config/aggregate"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// Analyzer defines the interface for unified analysis use cases.
// Combines bullish divergence, bearish divergence, and trendline signals
// into a single analysis, reducing redundant API calls.
//
// Returns a plain DTO containing raw domain data.
// The presentation layer is responsible for converting to API response format.
type Analyzer interface {
	Execute(ctx context.Context, q marketvo.MarketDataQuery, configID string) (*dto.AnalysisResult, error)
	// GetConfig fetches a trading configuration by ID without running analysis.
	GetConfig(ctx context.Context, configID string) (*aggregate.TradingConfig, error)
}
