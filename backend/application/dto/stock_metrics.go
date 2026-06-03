package dto

import (
	"time"

	metricsagg "backend/domain/metrics/aggregate"
	filtervo "backend/domain/shared/valueobject/filter"
)

// StockMetricsResult holds the complete result of stock metrics calculation.
type StockMetricsResult struct {
	TotalStocksAnalyzed int                        `json:"total_stocks_analyzed"`
	StocksMatching      int                        `json:"stocks_matching"`
	CalculatedAt        time.Time                  `json:"calculated_at"`
	Stocks              []*metricsagg.StockMetrics `json:"stocks"`
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
