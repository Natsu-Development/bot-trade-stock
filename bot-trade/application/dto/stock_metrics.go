package dto

import (
	"encoding/json"
	"fmt"
	"time"

	metricsagg "bot-trade/domain/metrics/aggregate"
	filtervo "bot-trade/domain/shared/valueobject/filter"
)

// FilterValue accepts both boolean and numeric JSON values.
// Boolean true → 1.0, false → 0.0.
type FilterValue float64

func (v *FilterValue) UnmarshalJSON(data []byte) error {
	var b bool
	if err := json.Unmarshal(data, &b); err == nil {
		*v = 0
		if b {
			*v = 1
		}
		return nil
	}

	var f float64
	if err := json.Unmarshal(data, &f); err != nil {
		return fmt.Errorf("value must be boolean or number: %w", err)
	}
	*v = FilterValue(f)
	return nil
}

// StockMetricsResult holds the complete result of stock metrics calculation.
type StockMetricsResult struct {
	TotalStocksAnalyzed int                      `json:"total_stocks_analyzed"`
	StocksMatching      int                      `json:"stocks_matching"`
	CalculatedAt        time.Time                `json:"calculated_at"`
	Stocks              []*metricsagg.StockMetrics `json:"stocks"`
}

// StockFilterRequest is the DTO for stock filter API requests.
// JSON keys match frontend format ("op" instead of "operator").
type StockFilterRequest struct {
	Filters   []FilterConditionRequest `json:"filters"`
	Logic     string                   `json:"logic"`
	Exchanges []string                 `json:"exchanges,omitempty"`
}

// FilterConditionRequest is the DTO for a single filter condition.
type FilterConditionRequest struct {
	Field string      `json:"field"`
	Op    string      `json:"op"` // Frontend uses "op"
	Value FilterValue `json:"value"`
}

// ToDomain converts DTO to domain value object with validation.
func (r *StockFilterRequest) ToDomain() (*filtervo.StockFilter, error) {
	conditions := make([]filtervo.FilterCondition, len(r.Filters))
	for i, fc := range r.Filters {
		cond, err := filtervo.NewFilterCondition(fc.Field, fc.Op, float64(fc.Value))
		if err != nil {
			return nil, err
		}
		conditions[i] = cond
	}

	return filtervo.NewStockFilter(conditions, r.Logic, r.Exchanges)
}
