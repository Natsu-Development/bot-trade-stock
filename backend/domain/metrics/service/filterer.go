// Package service provides domain services for stock metrics filtering.
package service

import (
	metricsagg "backend/domain/metrics/aggregate"
	filtervo "backend/domain/shared/valueobject/filter"
)

// Matches reports whether a stock satisfies the filter. Exchanges are a hard
// outer AND (never negated); the rest is a flat two-level scope.
func Matches(stock *metricsagg.StockMetrics, f *filtervo.StockFilter) bool {
	// Check exchange filter first (always AND with other conditions, never negated).
	if len(f.Exchanges) > 0 && !matchesExchanges(stock, f.Exchanges) {
		return false
	}

	res := evalScope(stock, f.Match, f.Conditions, f.Groups)
	if f.Negate {
		return !res
	}
	return res
}

// evalScope combines a level's conditions + groups under one combinator
// (short-circuits). Shared by the top level and each group (groups pass nil groups).
func evalScope(stock *metricsagg.StockMetrics, m filtervo.MatchMode, conds []filtervo.Condition, groups []filtervo.Group) bool {
	if len(conds) == 0 && len(groups) == 0 {
		return true // empty scope = match-all; caller applies Negate
	}

	if m == filtervo.MatchOr { // OR
		for _, c := range conds {
			if evalCondition(stock, c) {
				return true
			}
		}
		for _, g := range groups {
			if evalGroup(stock, g) {
				return true
			}
		}
		return false
	}

	for _, c := range conds { // AND (default)
		if !evalCondition(stock, c) {
			return false
		}
	}
	for _, g := range groups {
		if !evalGroup(stock, g) {
			return false
		}
	}
	return true
}

// evalGroup evaluates one group (conditions only, no sub-groups), applying Negate.
func evalGroup(stock *metricsagg.StockMetrics, g filtervo.Group) bool {
	res := evalScope(stock, g.Match, g.Conditions, nil)
	if g.Negate {
		return !res
	}
	return res
}

// evalCondition evaluates a single leaf condition against a stock.
//   - signal field: direct boolean comparison;
//   - moving-average field: compare current price vs the MA value;
//   - numeric field: compare the field value vs the condition value.
func evalCondition(stock *metricsagg.StockMetrics, c filtervo.Condition) bool {
	switch {
	case c.Field.IsSignal():
		return getSignalFieldValue(stock, c.Field) == c.BoolValue()
	case c.Field.IsMovingAverage():
		return comparePriceVsMA(stock.CurrentPrice, getFieldValue(stock, c.Field), c.Op)
	default:
		return compareNum(getFieldValue(stock, c.Field), c.Op, c.Val())
	}
}

// compareNum applies a comparison operator between two numbers.
func compareNum(fieldValue float64, op filtervo.FilterOperator, value float64) bool {
	switch op {
	case filtervo.OperatorGreaterThanOrEqual:
		return fieldValue >= value
	case filtervo.OperatorLessThanOrEqual:
		return fieldValue <= value
	case filtervo.OperatorGreaterThan:
		return fieldValue > value
	case filtervo.OperatorLessThan:
		return fieldValue < value
	case filtervo.OperatorEqual:
		// exact float == is intentional: pre-existing behaviour carried over by the filter revamp.
		// these metrics are never exactly equal in practice, so this branch is effectively unreachable.
		// epsilon-comparison semantics are deliberately out of scope.
		return fieldValue == value
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
		// exact float == is intentional: pre-existing behaviour carried over by the filter revamp.
		// price never exactly equals an MA value in practice, so this branch is effectively unreachable.
		// epsilon-comparison semantics are deliberately out of scope.
		return currentPrice == maValue // price equals MA
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
