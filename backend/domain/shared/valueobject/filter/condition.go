// Package filter provides shared immutable value objects for screener filter bounded contexts.
package filter

// Condition is a single leaf comparison. The Field's kind drives Op/Value usage:
//   - numeric field: Op + Value (a number) required;
//   - moving-average field: Op required, Value unused (compares price vs the MA);
//   - signal field: Op must be "=", Value is a bool (nil coerces to false).
//
// Value reuses FilterValue (number | bool→1/0) so JSON+BSON marshal natively.
type Condition struct {
	Field FilterField    `json:"field"           bson:"field"`
	Op    FilterOperator `json:"op,omitempty"    bson:"op,omitempty"`
	Value *FilterValue   `json:"value,omitempty" bson:"value,omitempty"`
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

// validate enforces the per-field-kind invariants for one condition.
func (c Condition) validate() error {
	switch {
	case c.Field.IsSignal():
		if c.Op != OperatorEqual {
			return ErrSignalOperatorUnsupported
		}
		// Value optional: nil coerces to false (existing contract).
	case c.Field.IsMovingAverage():
		if c.Op == "" {
			return ErrMissingOperator
		}
	default: // numeric
		if c.Op == "" {
			return ErrMissingOperator
		}
		if c.Value == nil {
			return ErrMissingValue
		}
	}
	return nil
}
