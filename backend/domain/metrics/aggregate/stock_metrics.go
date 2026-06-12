// Package aggregate provides stock metrics domain model including RS ratings and volume analysis.
package aggregate

import (
	periodvo "backend/domain/metrics/valueobject"
	marketvo "backend/domain/shared/valueobject/market"
)

// StockMetrics represents comprehensive metrics for a single stock. It carries
// CONFIG-INDEPENDENT metrics only: identity, the cross-universe RS percentile
// ratings (assigned by Calculator.RankAll), and the per-stock base metrics
// (returns, volume, price, moving averages — computed by CalculateBaseMetrics).
//
// The per-config trendline/divergence signal flags and the tick-time
// resistance/support levels are NOT stored here: they live in their own cache
// layers — analysisvo.SignalFlags (the screener's per-config signals,
// dto.ScreenerStock) and analysisvo.AlertTrendline (the watchlist alert-level store) —
// each computed per config from the shared snapshot's bars. Old persisted
// documents may still carry has_breakout_*/resistance_level bson fields; the
// driver ignores unknown fields on decode.
type StockMetrics struct {
	Symbol   marketvo.Symbol   `json:"symbol" bson:"symbol"`
	Name     string            `json:"name" bson:"name"`         // Vietnamese stock name from listallstock
	Exchange marketvo.Exchange `json:"exchange" bson:"exchange"` // HOSE, HNX, UPCOM

	// Ranked metrics — cross-universe RS percentiles (1-99, 0 if not enough data),
	// assigned by Calculator.RankAll from every stock's relative position.
	RS1M  int `json:"rs_1m" bson:"rs_1m"`
	RS3M  int `json:"rs_3m" bson:"rs_3m"`
	RS6M  int `json:"rs_6m" bson:"rs_6m"`
	RS9M  int `json:"rs_9m" bson:"rs_9m"`
	RS52W int `json:"rs_52w" bson:"rs_52w"`

	// Base metrics — computed per stock from its own price history.
	PeriodReturns periodvo.PeriodReturns `json:"period_returns" bson:"period_returns"`
	CurrentVolume int64                  `json:"current_volume" bson:"current_volume"` // Today's volume
	VolumeSMA20   int64                  `json:"volume_sma20" bson:"volume_sma20"`     // 20-day SMA of volume

	CurrentPrice   float64 `json:"current_price" bson:"current_price"`       // Latest close price
	PriceChangePct float64 `json:"price_change_pct" bson:"price_change_pct"` // % change from previous close

	EMA9   float64 `json:"ema_9" bson:"ema_9"`     // 9-period EMA
	EMA21  float64 `json:"ema_21" bson:"ema_21"`   // 21-period EMA
	EMA50  float64 `json:"ema_50" bson:"ema_50"`   // 50-period EMA
	SMA200 float64 `json:"sma_200" bson:"sma_200"` // 200-period SMA
}

// GetVolumeVsSMA calculates the percentage of current volume vs SMA20 on-demand.
// Returns ((current - sma) / sma) * 100, e.g., 50 means 50% above SMA.
func (s *StockMetrics) GetVolumeVsSMA() float64 {
	if s.VolumeSMA20 == 0 {
		return 0
	}
	return float64(s.CurrentVolume-s.VolumeSMA20) / float64(s.VolumeSMA20) * 100
}
