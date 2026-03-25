// Package valueobject provides immutable value objects for the metrics domain.
package valueobject

import (
	filtervo "bot-trade/domain/shared/valueobject/filter"
)

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
	Field       filtervo.FilterField // "rs_1m", "rs_3m", "rs_6m", "rs_9m", "rs_52w"
	TradingDays int                  // 21, 63, 126, 189, 252
	ReturnField string               // "P1", "P3", "P6", "P9", "P12" (PeriodReturns field)
}

// Predefined periods - single source of truth for all metrics constants.
var (
	Period1M  = Period{Field: filtervo.FieldRS1M, TradingDays: 21, ReturnField: "P1"}
	Period3M  = Period{Field: filtervo.FieldRS3M, TradingDays: 63, ReturnField: "P3"}
	Period6M  = Period{Field: filtervo.FieldRS6M, TradingDays: 126, ReturnField: "P6"}
	Period9M  = Period{Field: filtervo.FieldRS9M, TradingDays: 189, ReturnField: "P9"}
	Period52W = Period{Field: filtervo.FieldRS52W, TradingDays: 252, ReturnField: "P12"}
)

// Metrics calculation constants.
const (
	VolumeSMAPeriod = 20 // 20-day SMA for volume
	MinDataPoints   = 21 // Minimum 1 month of trading data
)
