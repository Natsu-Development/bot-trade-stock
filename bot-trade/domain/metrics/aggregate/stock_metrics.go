// Package aggregate provides stock metrics domain model including RS ratings and volume analysis.
package aggregate

import (
	periodvo "bot-trade/domain/metrics/valueobject"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// StockMetrics represents comprehensive metrics for a single stock.
type StockMetrics struct {
	Symbol        marketvo.Symbol   `json:"symbol" bson:"symbol"`
	Name          string            `json:"name" bson:"name"`         // Vietnamese stock name from listallstock
	Exchange      marketvo.Exchange `json:"exchange" bson:"exchange"` // HOSE, HNX, UPCOM
	RS1M          int               `json:"rs_1m" bson:"rs_1m"`       // 1-month percentile (1-99), 0 if not enough data
	RS3M          int               `json:"rs_3m" bson:"rs_3m"`       // 3-month percentile (1-99), 0 if not enough data
	RS6M          int               `json:"rs_6m" bson:"rs_6m"`       // 6-month percentile (1-99), 0 if not enough data
	RS9M          int               `json:"rs_9m" bson:"rs_9m"`       // 9-month percentile (1-99), 0 if not enough data
	RS52W         int               `json:"rs_52w" bson:"rs_52w"`     // 52-week percentile (1-99), 0 if not enough data
	PeriodReturns periodvo.PeriodReturns `json:"period_returns" bson:"period_returns"`
	CurrentVolume int64             `json:"current_volume" bson:"current_volume"` // Today's volume
	VolumeSMA20   int64             `json:"volume_sma20" bson:"volume_sma20"`     // 20-day SMA of volume

	// Price metrics
	CurrentPrice   float64 `json:"current_price" bson:"current_price"`       // Latest close price
	PriceChangePct float64 `json:"price_change_pct" bson:"price_change_pct"` // % change from previous close

	// Moving averages
	EMA9   float64 `json:"ema_9" bson:"ema_9"`     // 9-period EMA
	EMA21  float64 `json:"ema_21" bson:"ema_21"`   // 21-period EMA
	EMA50  float64 `json:"ema_50" bson:"ema_50"`   // 50-period EMA
	SMA200 float64 `json:"sma_200" bson:"sma_200"` // 200-period SMA

	// Signal metrics (from trendline and divergence analysis on daily timeframe)
	HasBreakoutPotential  bool `json:"has_breakout_potential" bson:"has_breakout_potential"`
	HasBreakoutConfirmed  bool `json:"has_breakout_confirmed" bson:"has_breakout_confirmed"`
	HasBreakdownPotential bool `json:"has_breakdown_potential" bson:"has_breakdown_potential"`
	HasBreakdownConfirmed bool `json:"has_breakdown_confirmed" bson:"has_breakdown_confirmed"`
	HasBullishRSI         bool `json:"has_bullish_rsi" bson:"has_bullish_rsi"`
	HasBearishRSI         bool `json:"has_bearish_rsi" bson:"has_bearish_rsi"`
}

// GetVolumeVsSMA calculates the percentage of current volume vs SMA20 on-demand.
// Returns ((current - sma) / sma) * 100, e.g., 50 means 50% above SMA.
func (s *StockMetrics) GetVolumeVsSMA() float64 {
	if s.VolumeSMA20 == 0 {
		return 0
	}
	return float64(s.CurrentVolume-s.VolumeSMA20) / float64(s.VolumeSMA20) * 100
}