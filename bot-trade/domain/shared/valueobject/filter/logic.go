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
	// ErrInvalidFilterLogic is returned when filter logic validation fails.
	ErrInvalidFilterLogic = errors.New("filter logic must be either 'and' or 'or'")
)

// FilterLogic is a value object representing the logical operator for combining filters.
// Immutable - use NewFilterLogic to create validated instances.
type FilterLogic string

// Valid filter logic operators.
const (
	LogicAND FilterLogic = "and"
	LogicOR  FilterLogic = "or"
)

// Validate creates a validated FilterLogic.
func Validate(value string) (FilterLogic, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	logic := FilterLogic(normalized)

	if logic != LogicAND && logic != LogicOR {
		return "", ErrInvalidFilterLogic
	}

	return logic, nil
}

// MarshalJSON implements json.Marshaler for FilterLogic.
func (l FilterLogic) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(l))
}

// UnmarshalJSON implements json.Unmarshaler for FilterLogic with validation.
func (l *FilterLogic) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	logic, err := Validate(s)
	if err != nil {
		return err
	}
	*l = logic
	return nil
}