package market

import (
	"errors"
	"regexp"
	"strings"
)

// Symbol is a value object representing a stock symbol.
type Symbol string

// symbolRegex validates that symbol contains only alphanumeric characters.
var symbolRegex = regexp.MustCompile(`^[A-Z0-9]+$`)

// NewSymbol creates a validated Symbol.
func NewSymbol(value string) (Symbol, error) {
	if value == "" {
		return "", errors.New("symbol cannot be empty")
	}

	value = strings.ToUpper(strings.TrimSpace(value))

	if len(value) < 2 || len(value) > 10 {
		return "", errors.New("symbol must be between 2 and 10 characters")
	}

	if !symbolRegex.MatchString(value) {
		return "", errors.New("symbol must contain only alphanumeric characters")
	}

	return Symbol(value), nil
}

// String returns the symbol value.
func (s Symbol) String() string {
	return string(s)
}
