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
	// Execute performs divergence analysis for the given query using the specified config.
	// Returns an AnalysisResult domain entity with the analysis results or an error
	// if the analysis could not be completed.
	Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*analysis.AnalysisResult, error)
}
