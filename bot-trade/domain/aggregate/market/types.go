package market

import (
	"errors"
	"regexp"
	"strings"
)

// PriceData represents individual price point data.
type PriceData struct {
	Date  string
	Close float64
}

// Symbol is a value object representing a stock symbol.
type Symbol string

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

// Interval is a value object representing a data interval.
type Interval string

var supportedIntervals = map[string]bool{
	"1m":  true,
	"5m":  true,
	"15m": true,
	"30m": true,
	"1H":  true,
	"4H":  true,
	"1D":  true,
	"1W":  true,
	"1M":  true,
}

// NewInterval creates a validated Interval.
func NewInterval(value string) (Interval, error) {
	if value == "" {
		value = "1D"
	}

	if !supportedIntervals[value] {
		return "", errors.New("unsupported interval: supported values are 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M")
	}

	return Interval(value), nil
}

// String returns the interval value.
func (i Interval) String() string {
	return string(i)
}

