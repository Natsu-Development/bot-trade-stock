// Package dto provides data transfer objects for the application layer.
// These are not domain objects - they coordinate multiple domain results for use case responses.
package dto

import (
	"time"

	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
)

// AnalysisResult is the unified application DTO for analysis responses.
// This belongs in the application layer because it orchestrates multiple domain results.
// It is NOT a domain aggregate - it's a coordination object for the use case.
type AnalysisResult struct {
	Symbol           string
	ProcessingTimeMs int64
	Timestamp        time.Time
	StartDate        string
	EndDate          string
	Interval         string
	CurrentPrice     float64
	CurrentRSI       float64

	// Composed domain results
	BullishDivergence *analysis.AnalysisResult
	BearishDivergence *analysis.AnalysisResult
	Signals           []market.TradingSignal
	PriceHistory      []market.MarketData
	Trendlines        []market.TrendlineDisplay
}

// NewAnalysisResult creates a new AnalysisResult DTO.
func NewAnalysisResult(symbol, startDate, endDate, interval string, currentPrice float64) *AnalysisResult {
	return &AnalysisResult{
		Symbol:       symbol,
		StartDate:    startDate,
		EndDate:      endDate,
		Interval:     interval,
		CurrentPrice: currentPrice,
		Timestamp:    time.Now(),
	}
}

// HasConfirmedSignals returns true if there are any confirmed signals.
func (r *AnalysisResult) HasConfirmedSignals() bool {
	for _, s := range r.Signals {
		if s.IsConfirmed() {
			return true
		}
	}
	return false
}

// HasWatchingSignals returns true if there are any watching or potential signals.
func (r *AnalysisResult) HasWatchingSignals() bool {
	for _, s := range r.Signals {
		if s.IsWatching() || s.IsPotential() {
			return true
		}
	}
	return false
}

// HasAnyDivergence returns true if either bullish or bearish divergence was found.
func (r *AnalysisResult) HasAnyDivergence() bool {
	if r.BullishDivergence != nil && r.BullishDivergence.HasDivergence() {
		return true
	}
	if r.BearishDivergence != nil && r.BearishDivergence.HasDivergence() {
		return true
	}
	return false
}

// Builder pattern for fluent construction

// WithBullishDivergence sets the bullish divergence result.
func (r *AnalysisResult) WithBullishDivergence(result *analysis.AnalysisResult) *AnalysisResult {
	r.BullishDivergence = result
	return r
}

// WithBearishDivergence sets the bearish divergence result.
func (r *AnalysisResult) WithBearishDivergence(result *analysis.AnalysisResult) *AnalysisResult {
	r.BearishDivergence = result
	return r
}

// WithSignals sets the trading signals.
func (r *AnalysisResult) WithSignals(signals []market.TradingSignal) *AnalysisResult {
	r.Signals = signals
	return r
}

// WithPriceHistory sets the price history data.
func (r *AnalysisResult) WithPriceHistory(history []market.MarketData) *AnalysisResult {
	r.PriceHistory = history
	return r
}

// WithTrendlines sets the trendlines for display.
func (r *AnalysisResult) WithTrendlines(trendlines []market.TrendlineDisplay) *AnalysisResult {
	r.Trendlines = trendlines
	return r
}

// WithProcessingTime sets the processing time in milliseconds.
func (r *AnalysisResult) WithProcessingTime(ms int64) *AnalysisResult {
	r.ProcessingTimeMs = ms
	return r
}

// WithCurrentRSI sets the current RSI value.
func (r *AnalysisResult) WithCurrentRSI(rsi float64) *AnalysisResult {
	r.CurrentRSI = rsi
	return r
}
