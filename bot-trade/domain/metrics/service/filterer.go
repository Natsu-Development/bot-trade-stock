// Package service provides domain services for stock metrics filtering.
package service

import (
	filtervo "bot-trade/domain/shared/valueobject/filter"
	metricsagg "bot-trade/domain/metrics/aggregate"
)

// Matches checks if a stock matches the filter criteria.
func Matches(stock *metricsagg.StockMetrics, filter *filtervo.StockFilter) bool {
	// Check exchange filter first (always AND with other conditions)
	if len(filter.Exchanges) > 0 && !matchesExchanges(stock, filter.Exchanges) {
		return false
	}

	// If no field conditions, exchange match is sufficient
	if len(filter.Conditions) == 0 {
		return true
	}

	// Apply AND or OR logic
	if filter.Logic == filtervo.LogicOR {
		return matchesAny(stock, filter.Conditions)
	}
	return matchesAll(stock, filter.Conditions) // Default to AND
}

// matchesAll returns true if ALL conditions match (AND logic).
func matchesAll(stock *metricsagg.StockMetrics, conditions []filtervo.FilterCondition) bool {
	for _, condition := range conditions {
		if !matchesCondition(stock, condition) {
			return false
		}
	}
	return true
}

// matchesAny returns true if ANY condition matches (OR logic).
func matchesAny(stock *metricsagg.StockMetrics, conditions []filtervo.FilterCondition) bool {
	for _, condition := range conditions {
		if matchesCondition(stock, condition) {
			return true
		}
	}
	return false
}

// matchesCondition checks if a single condition matches.
func matchesCondition(stock *metricsagg.StockMetrics, condition filtervo.FilterCondition) bool {
	fieldValue := getFieldValue(stock, condition.Field)

	switch condition.Operator {
	case filtervo.OperatorGreaterThanOrEqual:
		return fieldValue >= condition.Value
	case filtervo.OperatorLessThanOrEqual:
		return fieldValue <= condition.Value
	case filtervo.OperatorGreaterThan:
		return fieldValue > condition.Value
	case filtervo.OperatorLessThan:
		return fieldValue < condition.Value
	case filtervo.OperatorEqual:
		return fieldValue == condition.Value
	default:
		return false
	}
}

// getFieldValue returns the value of a field for comparison.
func getFieldValue(stock *metricsagg.StockMetrics, field filtervo.FilterField) float64 {
	switch field {
	case filtervo.FieldRS1M:
		return float64(stock.RS1M)
	case filtervo.FieldRS3M:
		return float64(stock.RS3M)
	case filtervo.FieldRS6M:
		return float64(stock.RS6M)
	case filtervo.FieldRS9M:
		return float64(stock.RS9M)
	case filtervo.FieldRS52W:
		return float64(stock.RS52W)
	case filtervo.FieldVolumeVsSMA:
		return stock.GetVolumeVsSMA()
	case filtervo.FieldCurrentVolume:
		return float64(stock.CurrentVolume)
	case filtervo.FieldVolumeSMA20:
		return float64(stock.VolumeSMA20)
	default:
		return 0
	}
}

// matchesExchanges checks if the stock's exchange is in the allowed list.
func matchesExchanges(stock *metricsagg.StockMetrics, exchanges []string) bool {
	for _, exchange := range exchanges {
		if string(stock.Exchange) == exchange {
			return true
		}
	}
	return false
}
