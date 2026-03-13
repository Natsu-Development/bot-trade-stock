package dto

import (
	"time"

	metricsagg "bot-trade/domain/metrics/aggregate"
)

// StockMetricsResult holds the complete result of stock metrics calculation.
type StockMetricsResult struct {
	TotalStocksAnalyzed int                      `json:"total_stocks_analyzed"`
	StocksMatching      int                      `json:"stocks_matching"`
	CalculatedAt        time.Time                `json:"calculated_at"`
	Stocks              []*metricsagg.StockMetrics `json:"stocks"`
}
