package analysis

import (
	"time"

	"bot-trade/domain/aggregate/market"
)

// AnalysisResult represents the complete result of a divergence analysis.
// This is the aggregate root for analysis results in the domain.
type AnalysisResult struct {
	symbol           string
	divergence       *DivergenceResult
	processingTimeMs int64
	query            market.MarketDataQuery
	rsiPeriod        int
	timestamp        time.Time
}

// NewAnalysisResult creates a new AnalysisResult with all required data.
func NewAnalysisResult(
	symbol string,
	divergence *DivergenceResult,
	processingTimeMs int64,
	q market.MarketDataQuery,
	rsiPeriod int,
) *AnalysisResult {
	return &AnalysisResult{
		symbol:           symbol,
		divergence:       divergence,
		processingTimeMs: processingTimeMs,
		query:            q,
		rsiPeriod:        rsiPeriod,
		timestamp:        time.Now(),
	}
}

// Symbol returns the analyzed symbol.
func (r *AnalysisResult) Symbol() string {
	return r.symbol
}

// Divergence returns the divergence detection result.
func (r *AnalysisResult) Divergence() *DivergenceResult {
	return r.divergence
}

// ProcessingTimeMs returns the processing time in milliseconds.
func (r *AnalysisResult) ProcessingTimeMs() int64 {
	return r.processingTimeMs
}

// Query returns the original query parameters.
func (r *AnalysisResult) Query() market.MarketDataQuery {
	return r.query
}

// RSIPeriod returns the RSI period used for analysis.
func (r *AnalysisResult) RSIPeriod() int {
	return r.rsiPeriod
}

// Timestamp returns when the analysis was performed.
func (r *AnalysisResult) Timestamp() time.Time {
	return r.timestamp
}

// HasDivergence returns true if a divergence was detected.
func (r *AnalysisResult) HasDivergence() bool {
	return r.divergence != nil && r.divergence.DivergenceFound()
}
