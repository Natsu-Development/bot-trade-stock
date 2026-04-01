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
	// Handle signal fields (boolean) with = operator
	if condition.Field.IsSignal() {
		return matchesSignalField(stock, condition)
	}

	fieldValue := getFieldValue(stock, condition.Field)

	// For moving average fields, compare current price against MA value
	if condition.Field.IsMovingAverage() {
		return comparePriceVsMA(stock.CurrentPrice, fieldValue, condition.Operator)
	}

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

// comparePriceVsMA compares current price against MA value using the operator.
func comparePriceVsMA(currentPrice, maValue float64, operator filtervo.FilterOperator) bool {
	switch operator {
	case filtervo.OperatorGreaterThanOrEqual:
		return currentPrice >= maValue // Price at or above MA
	case filtervo.OperatorLessThanOrEqual:
		return currentPrice <= maValue // Price at or below MA
	case filtervo.OperatorGreaterThan:
		return currentPrice > maValue // Price above MA
	case filtervo.OperatorLessThan:
		return currentPrice < maValue // Price below MA
	case filtervo.OperatorEqual:
		return currentPrice == maValue // Price equals MA
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

	// Price fields
	case filtervo.FieldCurrentPrice:
		return stock.CurrentPrice
	case filtervo.FieldPriceChangePct:
		return stock.PriceChangePct

	// Moving average fields
	case filtervo.FieldEMA9:
		return stock.EMA9
	case filtervo.FieldEMA21:
		return stock.EMA21
	case filtervo.FieldEMA50:
		return stock.EMA50
	case filtervo.FieldSMA200:
		return stock.SMA200

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

// matchesSignalField checks if a signal (boolean) field matches the condition.
// Uses direct boolean comparison - no numeric transformation.
func matchesSignalField(stock *metricsagg.StockMetrics, condition filtervo.FilterCondition) bool {
	boolValue := getSignalFieldValue(stock, condition.Field)

	// Direct boolean comparison - only = operator is meaningful
	if condition.Operator == filtervo.OperatorEqual {
		return boolValue == condition.GetBoolValue()
	}

	// Other operators not supported for boolean fields
	return false
}

// getSignalFieldValue returns the boolean value of a signal field.
func getSignalFieldValue(stock *metricsagg.StockMetrics, field filtervo.FilterField) bool {
	switch field {
	case filtervo.FieldHasBreakoutPotential:
		return stock.HasBreakoutPotential
	case filtervo.FieldHasBreakoutConfirmed:
		return stock.HasBreakoutConfirmed
	case filtervo.FieldHasBreakdownPotential:
		return stock.HasBreakdownPotential
	case filtervo.FieldHasBreakdownConfirmed:
		return stock.HasBreakdownConfirmed
	case filtervo.FieldHasBullishRSI:
		return stock.HasBullishRSI
	case filtervo.FieldHasBearishRSI:
		return stock.HasBearishRSI
	default:
		return false
	}
}
