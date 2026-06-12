// Package service provides domain services for stock metrics filtering.
package service

import (
	analysisvo "backend/domain/analysis/valueobject"
	metricsagg "backend/domain/metrics/aggregate"
	filtervo "backend/domain/shared/valueobject/filter"
)

// Matches reports whether a stock satisfies the filter. Exchanges are a hard
// outer AND (never negated); the rest is a flat two-level scope.
//
// signalsBySymbol maps symbol → that config's signal flags and may be nil. The
// shared StockMetrics is base-only (no signal flags), so the per-config signals
// are the SOLE signal source: a symbol absent from the map — or a nil map —
// evaluates every signal flag as false. Numeric and moving-average fields (RS,
// volume, EMAs) always read off the shared stock.
func Matches(stock *metricsagg.StockMetrics, f *filtervo.StockFilter, signalsBySymbol map[string]analysisvo.SignalFlags) bool {
	// Check exchange filter first (always AND with other conditions, never negated).
	if len(f.Exchanges) > 0 && !matchesExchanges(stock, f.Exchanges) {
		return false
	}

	// Per-config signals are the sole signal source: an absent symbol (or nil map)
	// indexes to the zero Signals — every flag false.
	sig := signalsBySymbol[string(stock.Symbol)]
	res := evalScope(stock, sig, f.Match, f.Conditions, f.Groups)
	if f.Negate {
		return !res
	}
	return res
}

// evalScope combines a level's conditions + groups under one combinator
// (short-circuits). Shared by the top level and each group (groups pass nil groups).
func evalScope(stock *metricsagg.StockMetrics, sig analysisvo.SignalFlags, m filtervo.MatchMode, conds []filtervo.Condition, groups []filtervo.Group) bool {
	if len(conds) == 0 && len(groups) == 0 {
		return true // empty scope = match-all; caller applies Negate
	}

	if m == filtervo.MatchOr { // OR
		for _, c := range conds {
			if evalCondition(stock, sig, c) {
				return true
			}
		}
		for _, g := range groups {
			if evalGroup(stock, sig, g) {
				return true
			}
		}
		return false
	}

	for _, c := range conds { // AND (default)
		if !evalCondition(stock, sig, c) {
			return false
		}
	}
	for _, g := range groups {
		if !evalGroup(stock, sig, g) {
			return false
		}
	}
	return true
}

// evalGroup evaluates one group (conditions only, no sub-groups), applying Negate.
func evalGroup(stock *metricsagg.StockMetrics, sig analysisvo.SignalFlags, g filtervo.Group) bool {
	res := evalScope(stock, sig, g.Match, g.Conditions, nil)
	if g.Negate {
		return !res
	}
	return res
}

// evalCondition evaluates a single leaf condition against a stock.
//   - field comparison (RhsField set): compare two price/MA fields directly;
//   - signal field: direct boolean comparison (read from the resolved sig);
//   - moving-average field: compare current price vs the MA value;
//   - numeric field: compare the field value vs the condition value.
//
// The field-comparison case is checked FIRST (mirroring Condition.validate's
// branch order) so a price/MA LHS routes here instead of the legacy MA branch.
func evalCondition(stock *metricsagg.StockMetrics, sig analysisvo.SignalFlags, c filtervo.Condition) bool {
	switch {
	case c.RhsField != nil:
		// Field-vs-field comparison (e.g. EMA 9 >= EMA 21, Price < EMA 50). Reuse
		// getFieldValue (already resolves current_price + all MAs) and compareNum.
		lhs := getFieldValue(stock, c.Field)
		rhs := getFieldValue(stock, *c.RhsField)
		// Warm-up/no-data guard: indicators return 0 below their period and a
		// no-trade stock has price 0. A 0 operand would spuriously match (e.g.
		// SMA200==0 < EMA9), so exclude when either side is non-positive. Real
		// prices/MAs are always > 0, so no legitimate match is dropped.
		if lhs <= 0 || rhs <= 0 {
			return false
		}
		return compareNum(lhs, c.Op, rhs)
	case c.Field.IsSignal():
		return getSignalFieldValue(sig, c.Field) == c.BoolValue()
	default:
		// Numeric comparison (RS, volume, price-change, and current_price-vs-number).
		// A bare moving-average leaf can never reach here — validate() rejects an MA
		// field without an RhsField, so every price/MA comparison is the field-vs-field
		// case above.
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
	default:
		// '=' never reaches here — Condition.validate rejects numeric and
		// field-vs-field equality, and signals use a direct boolean compare.
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

// getSignalFieldValue returns the boolean value of a signal field, read from the
// resolved per-stock Signals (from the per-config signals, or zero when absent).
func getSignalFieldValue(sig analysisvo.SignalFlags, field filtervo.FilterField) bool {
	switch field {
	case filtervo.FieldHasBreakoutPotential:
		return sig.HasBreakoutPotential
	case filtervo.FieldHasBreakoutConfirmed:
		return sig.HasBreakoutConfirmed
	case filtervo.FieldHasBreakdownPotential:
		return sig.HasBreakdownPotential
	case filtervo.FieldHasBreakdownConfirmed:
		return sig.HasBreakdownConfirmed
	case filtervo.FieldHasBullishRSI:
		return sig.HasBullishRSI
	case filtervo.FieldHasBearishRSI:
		return sig.HasBearishRSI
	default:
		return false
	}
}
