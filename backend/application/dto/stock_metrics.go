package dto

import (
	"time"

	metricsagg "backend/domain/metrics/aggregate"
	filtervo "backend/domain/shared/valueobject/filter"
)

// ScreenerStock is one screener-response row: the config-independent base
// metrics (embedded, so they flatten into the same top-level JSON keys) plus the
// six per-config signal flags spliced in from the caller's per-config signals. The flag
// json tags reproduce the historical flat shape exactly, so the frontend is
// unaffected by the StockMetrics split. The tick-time resistance/support levels
// are intentionally absent — they are alert-path-only and the screener UI never
// read them.
type ScreenerStock struct {
	*metricsagg.StockMetrics
	HasBreakoutPotential  bool `json:"has_breakout_potential"`
	HasBreakoutConfirmed  bool `json:"has_breakout_confirmed"`
	HasBreakdownPotential bool `json:"has_breakdown_potential"`
	HasBreakdownConfirmed bool `json:"has_breakdown_confirmed"`
	HasBullishRSI         bool `json:"has_bullish_rsi"`
	HasBearishRSI         bool `json:"has_bearish_rsi"`
}

// StockMetricsResult holds the complete result of stock metrics calculation.
type StockMetricsResult struct {
	TotalStocksAnalyzed int              `json:"total_stocks_analyzed"`
	StocksMatching      int              `json:"stocks_matching"`
	CalculatedAt        time.Time        `json:"calculated_at"`
	Stocks              []*ScreenerStock `json:"stocks"`
}

// StockFilterRequest is the flat tree-only DTO for POST /stocks/filter.
// It embeds the domain StockFilter so the wire shape == the domain shape
// (match/conditions/groups/exchanges), decoded natively with validating VOs.
type StockFilterRequest struct {
	filtervo.StockFilter
}

// ToDomain validates the embedded filter and returns it. An empty filter decodes
// to a return-all filter; validation reports the first structural or cap violation.
func (r StockFilterRequest) ToDomain() (*filtervo.StockFilter, error) {
	f := r.StockFilter
	if err := f.Validate(); err != nil {
		return nil, err
	}
	return &f, nil
}
