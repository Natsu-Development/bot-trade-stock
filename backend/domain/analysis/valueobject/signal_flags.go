package valueobject

// SignalFlags is the per-config result of running trendline + RSI-divergence
// analysis over a single symbol's bars: the six boolean screener flags. It feeds
// the screener's per-config view (dto.ScreenerStock) ONLY.
//
// It is a pure VALUE. ComputeSignalFlags returns one and never mutates a shared
// StockMetrics or its input bars. The field names mirror the screener-response
// flags so they can be copied across 1:1. The tick-time resistance/support
// levels are a SEPARATE concern (see AlertTrendline + ComputeAlertTrendline) so the
// alert path computes only what it needs.
type SignalFlags struct {
	HasBreakoutPotential  bool
	HasBreakoutConfirmed  bool
	HasBreakdownPotential bool
	HasBreakdownConfirmed bool
	HasBullishRSI         bool
	HasBearishRSI         bool
}

// AlertTrendline is the tick-time resistance / support levels (and the proximity
// they were computed at) the 15s watchlist evaluator fires on. ComputeAlertTrendline
// produces it from the trendline pipeline ALONE (no RSI-divergence work). The
// per-config alert store keeps ONLY these (lean, watched-symbols-only).
type AlertTrendline struct {
	Resistance float64
	Support    float64
	Proximity  float64
}
