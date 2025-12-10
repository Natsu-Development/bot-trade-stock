package market

import (
	"errors"
	"regexp"
	"strings"
)

// Symbol represents a stock symbol value object
type Symbol struct {
	value string
}

// symbolRegex validates that symbol contains only alphanumeric characters
var symbolRegex = regexp.MustCompile(`^[A-Z0-9]+$`)

// NewSymbol creates a new symbol with validation.
// Symbol must be non-empty, 2-10 characters, and contain only uppercase alphanumeric characters.
func NewSymbol(value string) (*Symbol, error) {
	if value == "" {
		return nil, errors.New("symbol cannot be empty")
	}

	value = strings.ToUpper(strings.TrimSpace(value))

	if len(value) < 2 || len(value) > 10 {
		return nil, errors.New("symbol must be between 2 and 10 characters")
	}

	if !symbolRegex.MatchString(value) {
		return nil, errors.New("symbol must contain only alphanumeric characters")
	}

	return &Symbol{value: value}, nil
}

// Value returns the symbol value
func (s *Symbol) Value() string {
	return s.value
}

// String implements the Stringer interface
func (s *Symbol) String() string {
	return s.value
}

// Equals checks if two symbols are equal
func (s *Symbol) Equals(other *Symbol) bool {
	if other == nil {
		return false
	}
	return s.value == other.value
}
