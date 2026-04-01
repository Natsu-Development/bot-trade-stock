// Package valueobject provides immutable value objects for the metrics domain.
package valueobject

// PeriodReturns holds cumulative ROC for each time period.
type PeriodReturns struct {
	P1  float64 `json:"p1" bson:"p1"`   // 1-month cumulative return (21 days)
	P3  float64 `json:"p3" bson:"p3"`   // 3-month cumulative return (63 days)
	P6  float64 `json:"p6" bson:"p6"`   // 6-month cumulative return (126 days)
	P9  float64 `json:"p9" bson:"p9"`   // 9-month cumulative return (189 days)
	P12 float64 `json:"p12" bson:"p12"` // 12-month cumulative return (252 days)
}

// Period represents a trading period for RS Rating calculations.
type Period struct {
	TradingDays int // 21, 63, 126, 189, 252
}

// Predefined periods - single source of truth for all metrics constants.
var (
	Period1M  = Period{TradingDays: 21}
	Period3M  = Period{TradingDays: 63}
	Period6M  = Period{TradingDays: 126}
	Period9M  = Period{TradingDays: 189}
	Period52W = Period{TradingDays: 252}
)

// Metrics calculation constants.
const (
	VolumeSMAPeriod = 20 // 20-day SMA for volume
	MinDataPoints   = 21 // Minimum 1 month of trading data

	// Moving average periods
	EMA9   = 9
	EMA21  = 21
	EMA50  = 50
	SMA200 = 200
)
