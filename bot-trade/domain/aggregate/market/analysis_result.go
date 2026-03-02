package market

import "time"

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

	// Individual analysis results
	BullishDivergence *DivergenceResultWrapper
	BearishDivergence *DivergenceResultWrapper
	Signals           []TradingSignal
	PriceHistory      []*PriceData
	Trendlines        []TrendlineDisplay // All active trendlines for display with pre-calculated data points
}

// DivergenceResultWrapper wraps the analysis.AnalysisResult for JSON serialization.
// This avoids circular import issues with the analysis package.
type DivergenceResultWrapper struct {
	DivergenceType   string
	DivergenceFound  bool
	CurrentPrice     float64
	CurrentRSI       float64
	Description      string
	ProcessingTimeMs int64
	StartDate        string
	EndDate          string
	Interval         string
	RSIPeriod        int
	Timestamp        time.Time
	EarlySignal      bool
	EarlyDescription string
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
func (r *CombinedAnalysisResult) SetBullishDivergence(
	divergenceType string,
	divergenceFound bool,
	currentPrice, currentRSI float64,
	description string,
	processingTimeMs int64,
	startDate, endDate, interval string,
	rsiPeriod int,
	timestamp time.Time,
	earlySignal bool,
	earlyDescription string,
) {
	r.BullishDivergence = &DivergenceResultWrapper{
		DivergenceType:   divergenceType,
		DivergenceFound:  divergenceFound,
		CurrentPrice:     currentPrice,
		CurrentRSI:       currentRSI,
		Description:      description,
		ProcessingTimeMs: processingTimeMs,
		StartDate:        startDate,
		EndDate:          endDate,
		Interval:         interval,
		RSIPeriod:        rsiPeriod,
		Timestamp:        timestamp,
		EarlySignal:      earlySignal,
		EarlyDescription: earlyDescription,
	}
}

// SetBearishDivergence sets the bearish divergence result.
func (r *CombinedAnalysisResult) SetBearishDivergence(
	divergenceType string,
	divergenceFound bool,
	currentPrice, currentRSI float64,
	description string,
	processingTimeMs int64,
	startDate, endDate, interval string,
	rsiPeriod int,
	timestamp time.Time,
	earlySignal bool,
	earlyDescription string,
) {
	r.BearishDivergence = &DivergenceResultWrapper{
		DivergenceType:   divergenceType,
		DivergenceFound:  divergenceFound,
		CurrentPrice:     currentPrice,
		CurrentRSI:       currentRSI,
		Description:      description,
		ProcessingTimeMs: processingTimeMs,
		StartDate:        startDate,
		EndDate:          endDate,
		Interval:         interval,
		RSIPeriod:        rsiPeriod,
		Timestamp:        timestamp,
		EarlySignal:      earlySignal,
		EarlyDescription: earlyDescription,
	}
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
	if r.BullishDivergence != nil && r.BullishDivergence.DivergenceFound {
		return true
	}
	if r.BearishDivergence != nil && r.BearishDivergence.DivergenceFound {
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
