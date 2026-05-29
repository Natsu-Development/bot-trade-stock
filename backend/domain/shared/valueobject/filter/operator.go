// Package filter provides shared immutable value objects for screener filter bounded contexts.
// This is part of the Shared Kernel pattern - explicitly shared model elements that
// all contexts agree on and use consistently.
package filter

import (
	"encoding/json"
	"errors"
	"strings"
)

var (
	// ErrInvalidFilterOperator is returned when filter operator validation fails.
	ErrInvalidFilterOperator = errors.New("filter operator must be one of: >=, <=, >, <, =")
)

// FilterOperator is a value object representing a comparison operator for screener filters.
// Immutable - use NewFilterOperator to create validated instances.
type FilterOperator string

// Valid filter operators.
const (
	OperatorGreaterThanOrEqual FilterOperator = ">="
	OperatorLessThanOrEqual    FilterOperator = "<="
	OperatorGreaterThan        FilterOperator = ">"
	OperatorLessThan           FilterOperator = "<"
	OperatorEqual              FilterOperator = "="
)

var validOperators = []FilterOperator{
	OperatorGreaterThanOrEqual,
	OperatorLessThanOrEqual,
	OperatorGreaterThan,
	OperatorLessThan,
	OperatorEqual,
}

func isValidFilterOperator(op FilterOperator) bool {
	for _, valid := range validOperators {
		if valid == op {
			return true
		}
	}
	return false
}

// NewFilterOperator creates a validated FilterOperator.
func NewFilterOperator(value string) (FilterOperator, error) {
	normalized := strings.TrimSpace(value)
	op := FilterOperator(normalized)

	if !isValidFilterOperator(op) {
		return "", ErrInvalidFilterOperator
	}

	return op, nil
}

// ValidFilterOperators returns all valid filter operator names as strings.
func ValidFilterOperators() []string {
	result := make([]string, len(validOperators))
	for i, op := range validOperators {
		result[i] = string(op)
	}
	return result
}

// MarshalJSON implements json.Marshaler for FilterOperator.
func (o FilterOperator) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(o))
}

// UnmarshalJSON implements json.Unmarshaler for FilterOperator with validation.
func (o *FilterOperator) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	op, err := NewFilterOperator(s)
	if err != nil {
		return err
	}
	*o = op
	return nil
}
