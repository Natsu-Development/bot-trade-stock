package market

import (
	"time"

	"bot-trade/domain/aggregate/analysis"
)

// CombinedAnalysisResult is the aggregate root for unified analysis results.
// It combines bullish divergence, bearish divergence, and trendline signals
// into a single response to optimize API calls and reduce redundant processing.
type CombinedAnalysisResult struct {
	Symbol           string
	ProcessingTimeMs int64
	Timestamp        time.Time
	StartDate        string
	EndDate          string
	Interval         string
	CurrentPrice     float64

	BullishDivergence *analysis.AnalysisResult
	BearishDivergence *analysis.AnalysisResult
	Signals           []TradingSignal
	PriceHistory      []*PriceData
	Trendlines        []TrendlineDisplay
}

// NewCombinedAnalysisResult creates a new CombinedAnalysisResult.
func NewCombinedAnalysisResult(
	symbol string,
	processingTimeMs int64,
	startDate, endDate, interval string,
	currentPrice float64,
) *CombinedAnalysisResult {
	return &CombinedAnalysisResult{
		Symbol:           symbol,
		ProcessingTimeMs: processingTimeMs,
		Timestamp:        time.Now(),
		StartDate:        startDate,
		EndDate:          endDate,
		Interval:         interval,
		CurrentPrice:     currentPrice,
	}
}

// SetBullishDivergence sets the bullish divergence result.
func (r *CombinedAnalysisResult) SetBullishDivergence(result *analysis.AnalysisResult) {
	r.BullishDivergence = result
}

// SetBearishDivergence sets the bearish divergence result.
func (r *CombinedAnalysisResult) SetBearishDivergence(result *analysis.AnalysisResult) {
	r.BearishDivergence = result
}

// SetSignals sets the trading signals.
func (r *CombinedAnalysisResult) SetSignals(signals []TradingSignal) {
	r.Signals = signals
}

// SetPriceHistory sets the price history data.
func (r *CombinedAnalysisResult) SetPriceHistory(priceHistory []*PriceData) {
	r.PriceHistory = priceHistory
}

// HasAnySignal returns true if there are any trading signals.
func (r *CombinedAnalysisResult) HasAnySignal() bool {
	return len(r.Signals) > 0
}

// HasConfirmedSignals returns true if there are any confirmed signals.
func (r *CombinedAnalysisResult) HasConfirmedSignals() bool {
	for _, s := range r.Signals {
		if s.IsConfirmed() {
			return true
		}
	}
	return false
}

// HasAnyDivergence returns true if either bullish or bearish divergence was found.
func (r *CombinedAnalysisResult) HasAnyDivergence() bool {
	if r.BullishDivergence != nil && r.BullishDivergence.HasDivergence() {
		return true
	}
	if r.BearishDivergence != nil && r.BearishDivergence.HasDivergence() {
		return true
	}
	return false
}

// GetWatchingSignals returns only watching and potential signals.
func (r *CombinedAnalysisResult) GetWatchingSignals() []TradingSignal {
	var watching []TradingSignal
	for _, s := range r.Signals {
		if s.IsWatching() || s.IsPotential() {
			watching = append(watching, s)
		}
	}
	return watching
}

// GetConfirmedSignals returns only confirmed signals.
func (r *CombinedAnalysisResult) GetConfirmedSignals() []TradingSignal {
	var confirmed []TradingSignal
	for _, s := range r.Signals {
		if s.IsConfirmed() {
			confirmed = append(confirmed, s)
		}
	}
	return confirmed
}

// SetTrendlines sets the trendlines for display.
func (r *CombinedAnalysisResult) SetTrendlines(trendlines []TrendlineDisplay) {
	r.Trendlines = trendlines
}
