// Package filter provides shared immutable value objects for screener filter bounded contexts.
package filter

// FilterCondition represents a single filter condition for runtime queries.
// All values stored as float64: numeric = actual value, boolean = 0 (false) / 1 (true).
type FilterCondition struct {
	Field    FilterField
	Operator FilterOperator
	Value    float64
}

// IsBooleanField returns true if this condition is for a signal (boolean) field.
func (fc FilterCondition) IsBooleanField() bool {
	return fc.Field.IsSignal()
}

// GetBoolValue returns the value as boolean (0=false, non-zero=true).
func (fc FilterCondition) GetBoolValue() bool {
	return fc.Value != 0
}

// NewFilterCondition creates a validated filter condition.
// For boolean fields, use 0 for false and 1 for true.
func NewFilterCondition(field string, operator string, value float64) (FilterCondition, error) {
	ff, err := NewFilterField(field)
	if err != nil {
		return FilterCondition{}, err
	}

	op, err := NewFilterOperator(operator)
	if err != nil {
		return FilterCondition{}, err
	}

	return FilterCondition{
		Field:    ff,
		Operator: op,
		Value:    value,
	}, nil
}
