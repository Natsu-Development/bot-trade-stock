// Package filter provides shared immutable value objects for screener filter bounded contexts.
package filter

// Condition is a single leaf comparison. RhsField (when set) takes precedence and
// makes this a field-vs-field comparison; otherwise the Field's kind drives
// Op/Value usage:
//   - field comparison (RhsField set): compare Field against RhsField — both must
//     be price-or-MA and distinct, Op ∈ {>, <} (strict — both sides are floats),
//     Value must be nil (e.g. EMA 9 > EMA 21, Price < EMA 50);
//   - float numeric field (current_price vs a number, % change, vol×SMA): a strict
//     Op {>, <} plus a numeric Value (floats never land exactly on a threshold);
//   - integer numeric field (RS ranks, share volumes): an ordering Op {>, >=, <, <=}
//     plus a numeric Value — '=' is rejected (always-false footgun);
//   - moving-average field WITHOUT RhsField: invalid — an MA is only meaningful
//     compared to price or another MA, so it must use the field-comparison form above;
//   - signal field: Op must be "=", Value is a bool (nil coerces to false).
//
// Value reuses FilterValue (number | bool→1/0) so JSON+BSON marshal natively.
// RhsField is an optional pointer (omitempty) so existing numeric/signal/MA
// conditions are wire- and BSON-compatible (absent → nil).
type Condition struct {
	Field    FilterField    `json:"field"               bson:"field"`
	Op       FilterOperator `json:"op,omitempty"        bson:"op,omitempty"`
	Value    *FilterValue   `json:"value,omitempty"     bson:"value,omitempty"`
	RhsField *FilterField   `json:"rhs_field,omitempty" bson:"rhs_field,omitempty"`
}

// Val returns the numeric value (0 when unset).
func (c Condition) Val() float64 {
	if c.Value == nil {
		return 0
	}
	return float64(*c.Value)
}

// BoolValue returns the value as a boolean (0/nil → false, non-zero → true).
func (c Condition) BoolValue() bool { return FloatToBool(c.Val()) }

// validate enforces the per-field-kind invariants for one condition. The
// RhsField (field-comparison) case is checked FIRST so a price/MA LHS routes
// here rather than to the legacy moving-average branch; the matcher's
// evalCondition must mirror this branch order.
func (c Condition) validate() error {
	switch {
	case c.RhsField != nil:
		// Field-vs-field comparison (e.g. EMA 9 >= EMA 21, Price < EMA 50).
		if !c.Field.IsPriceOrMA() || !c.RhsField.IsPriceOrMA() {
			return ErrFieldComparisonField
		}
		if c.Field == *c.RhsField {
			return ErrFieldComparisonField // self-comparison is meaningless
		}
		// Both sides are price/MA floats — strict >/< only (never exactly equal).
		if !c.Op.IsStrictInequality() {
			return ErrFieldComparisonOperator
		}
		if c.Value != nil {
			return ErrUnexpectedValue
		}
	case c.Field.IsSignal():
		if c.Op != OperatorEqual {
			return ErrSignalOperatorUnsupported
		}
		// Value optional: nil coerces to false (existing contract).
	case c.Field.IsMovingAverage():
		// A bare MA leaf (no RhsField — the first case handles the explicit form) is
		// the retired implicit price-vs-MA form. A moving average is only meaningful
		// compared to price or another MA, so require the field-comparison form.
		return ErrMovingAverageRequiresComparison
	default: // numeric
		if c.Op == "" {
			return ErrMissingOperator
		}
		if c.Field.IsFloatValued() {
			// Continuous floats (price, % change, vol×SMA) never land exactly on a
			// threshold — strict >/< only (mirrors the field-comparison branch).
			if !c.Op.IsStrictInequality() {
				return ErrFloatOperatorUnsupported
			}
		} else if !c.Op.IsOrdering() {
			// Integer-valued numeric (RS ranks, share volumes): >, >=, <, <= — '='
			// is the only excluded operator (silent always-false footgun).
			return ErrNumericEqualityUnsupported
		}
		if c.Value == nil {
			return ErrMissingValue
		}
	}
	return nil
}
