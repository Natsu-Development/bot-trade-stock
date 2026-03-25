// Package filter provides shared immutable value objects for screener filter bounded contexts.
package filter

import (
	"encoding/json"
	"fmt"
)

// FilterCondition represents a single filter condition for runtime queries.
// JSON unmarshaling validates field and operator values.
type FilterCondition struct {
	Field    FilterField
	Operator FilterOperator
	Value    float64
}

// MarshalJSON implements json.Marshaler for FilterCondition.
func (fc FilterCondition) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Field    string  `json:"field"`
		Operator string  `json:"op"`
		Value    float64 `json:"value"`
	}{
		Field:    string(fc.Field),
		Operator: string(fc.Operator),
		Value:    fc.Value,
	})
}

// UnmarshalJSON implements json.Unmarshaler for FilterCondition with validation.
func (fc *FilterCondition) UnmarshalJSON(b []byte) error {
	type Alias FilterCondition // Prevent recursion
	var raw struct {
		Field    string  `json:"field"`
		Operator string  `json:"op"`
		Value    float64 `json:"value"`
	}

	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}

	field, err := NewFilterField(raw.Field)
	if err != nil {
		return fmt.Errorf("invalid field: %w", err)
	}

	operator, err := NewFilterOperator(raw.Operator)
	if err != nil {
		return fmt.Errorf("invalid operator: %w", err)
	}

	fc.Field = field
	fc.Operator = operator
	fc.Value = raw.Value
	return nil
}

// NewFilterCondition creates a validated filter condition.
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
