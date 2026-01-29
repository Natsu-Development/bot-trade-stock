// Package stockmetrics provides stock metrics domain model including RS ratings and volume analysis.
package stockmetrics

import "time"

// PeriodReturns holds cumulative ROC for each time period.
type PeriodReturns struct {
	P1  float64 `json:"p1" bson:"p1"`   // 1-month cumulative return (21 days)
	P3  float64 `json:"p3" bson:"p3"`   // 3-month cumulative return (63 days)
	P6  float64 `json:"p6" bson:"p6"`   // 6-month cumulative return (126 days)
	P9  float64 `json:"p9" bson:"p9"`   // 9-month cumulative return (189 days)
	P12 float64 `json:"p12" bson:"p12"` // 12-month cumulative return (252 days)
}

// StockMetrics represents comprehensive metrics for a single stock.
type StockMetrics struct {
	Symbol        string        `json:"symbol" bson:"symbol"`
	Exchange      string        `json:"exchange" bson:"exchange"` // HOSE, HNX, UPCOM
	RS1M          int           `json:"rs_1m" bson:"rs_1m"`       // 1-month percentile (1-99), 0 if not enough data
	RS3M          int           `json:"rs_3m" bson:"rs_3m"`       // 3-month percentile (1-99), 0 if not enough data
	RS6M          int           `json:"rs_6m" bson:"rs_6m"`       // 6-month percentile (1-99), 0 if not enough data
	RS9M          int           `json:"rs_9m" bson:"rs_9m"`       // 9-month percentile (1-99), 0 if not enough data
	RS52W         int           `json:"rs_52w" bson:"rs_52w"`     // 52-week percentile (1-99), 0 if not enough data
	PeriodReturns PeriodReturns `json:"period_returns" bson:"period_returns"`
	CurrentVolume int64         `json:"current_volume" bson:"current_volume"` // Today's volume
	VolumeSMA20   int64         `json:"volume_sma20" bson:"volume_sma20"`     // 20-day SMA of volume
}

// GetVolumeVsSMA calculates the percentage of current volume vs SMA20 on-demand.
// Returns ((current - sma) / sma) * 100, e.g., 50 means 50% above SMA.
func (s *StockMetrics) GetVolumeVsSMA() float64 {
	if s.VolumeSMA20 == 0 {
		return 0
	}
	return float64(s.CurrentVolume-s.VolumeSMA20) / float64(s.VolumeSMA20) * 100
}

// StockMetricsResult holds the complete result of stock metrics calculation.
type StockMetricsResult struct {
	TotalStocksAnalyzed int             `json:"total_stocks_analyzed"`
	StocksMatching      int             `json:"stocks_matching"`
	CalculatedAt        time.Time       `json:"calculated_at"`
	Stocks              []*StockMetrics `json:"stocks"`
}

// FilterOperator represents comparison operators for filtering.
type FilterOperator string

const (
	OpGreaterEqual FilterOperator = ">="
	OpLessEqual    FilterOperator = "<="
	OpGreater      FilterOperator = ">"
	OpLess         FilterOperator = "<"
	OpEqual        FilterOperator = "="
)

// FilterLogic represents the logical operator for combining conditions.
type FilterLogic string

const (
	LogicAnd FilterLogic = "and"
	LogicOr  FilterLogic = "or"
)

// FilterCondition represents a single filter condition.
type FilterCondition struct {
	Field    string         `json:"field"`
	Operator FilterOperator `json:"op"`
	Value    float64        `json:"value"`
}

// FilterRequest represents an advanced filter request with multiple conditions.
type FilterRequest struct {
	Conditions []FilterCondition `json:"filters"`
	Logic      FilterLogic       `json:"logic"`               // "and" or "or", defaults to "and"
	Exchanges  []string          `json:"exchanges,omitempty"` // Filter by exchanges (HOSE, HNX, UPCOM)
}

// GetFieldValue returns the value of a field for comparison.
func (s *StockMetrics) GetFieldValue(field string) float64 {
	switch field {
	case "rs_1m":
		return float64(s.RS1M)
	case "rs_3m":
		return float64(s.RS3M)
	case "rs_6m":
		return float64(s.RS6M)
	case "rs_9m":
		return float64(s.RS9M)
	case "rs_52w":
		return float64(s.RS52W)
	case "volume_vs_sma":
		return s.GetVolumeVsSMA()
	case "current_volume":
		return float64(s.CurrentVolume)
	case "volume_sma20":
		return float64(s.VolumeSMA20)
	default:
		return 0
	}
}

// MatchesCondition checks if the stock matches a single filter condition.
func (s *StockMetrics) MatchesCondition(cond FilterCondition) bool {
	value := s.GetFieldValue(cond.Field)
	switch cond.Operator {
	case OpGreaterEqual:
		return value >= cond.Value
	case OpLessEqual:
		return value <= cond.Value
	case OpGreater:
		return value > cond.Value
	case OpLess:
		return value < cond.Value
	case OpEqual:
		return value == cond.Value
	default:
		return false
	}
}

// MatchesFilter checks if the stock matches the filter request.
func (s *StockMetrics) MatchesFilter(req *FilterRequest) bool {
	// Check exchange filter first (always AND with other conditions)
	if len(req.Exchanges) > 0 {
		if !s.matchesExchanges(req.Exchanges) {
			return false
		}
	}

	// If no field conditions, exchange match is sufficient
	if len(req.Conditions) == 0 {
		return true
	}

	logic := req.Logic
	if logic == "" {
		logic = LogicAnd // Default to AND
	}

	if logic == LogicAnd {
		for _, cond := range req.Conditions {
			if !s.MatchesCondition(cond) {
				return false
			}
		}
		return true
	}

	// OR logic
	for _, cond := range req.Conditions {
		if s.MatchesCondition(cond) {
			return true
		}
	}
	return false
}

// matchesExchanges checks if the stock's exchange is in the allowed list.
func (s *StockMetrics) matchesExchanges(exchanges []string) bool {
	for _, ex := range exchanges {
		if s.Exchange == ex {
			return true
		}
	}
	return false
}
