// Package port defines application-layer interface contracts.
package port

import (
	"context"

	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
)

// DivergenceAnalyzer defines the interface for divergence analysis use cases.
// This interface enables handlers and schedulers to depend on an abstraction
// rather than a concrete use case implementation, following the Dependency
// Inversion Principle.
type DivergenceAnalyzer interface {
	// Execute performs divergence analysis, fetching its own market data.
	Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*analysis.AnalysisResult, error)
	// ExecuteWithData performs divergence analysis using pre-fetched price data,
	// avoiding redundant API calls when used alongside other analyzers.
	ExecuteWithData(ctx context.Context, priceHistory []*market.PriceData, q market.MarketDataQuery, configID string) (*analysis.AnalysisResult, error)
}

// TrendlineAnalyzer defines the interface for trendline-based signal analysis use cases.
// This interface enables handlers and schedulers to depend on an abstraction
// rather than a concrete use case implementation, following the Dependency
// Inversion Principle.
type TrendlineAnalyzer interface {
	// Execute performs trendline analysis, fetching its own market data.
	Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*market.SignalAnalysisResult, error)
	// ExecuteWithData performs trendline analysis using pre-fetched price data,
	// avoiding redundant API calls when used alongside other analyzers.
	ExecuteWithData(ctx context.Context, priceHistory []*market.PriceData, q market.MarketDataQuery, configID string) (*market.SignalAnalysisResult, error)
}

// Analyzer defines the interface for unified analysis use cases.
// This interface combines bullish divergence, bearish divergence, and trendline signals
// into a single analysis, reducing redundant API calls and shared operations.
type Analyzer interface {
	// Execute performs all analysis types for the given query using the specified config.
	// Returns a CombinedAnalysisResult domain entity with all analysis results or an error
	// if the analysis could not be completed.
	Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*market.CombinedAnalysisResult, error)
}
