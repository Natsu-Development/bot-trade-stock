// Package market provides shared immutable value objects for market and trading bounded contexts.
// This is part of the Shared Kernel pattern - explicitly shared model elements that
// all contexts agree on and use consistently.
package market

import (
	"errors"
	"strings"
)

var (
	// ErrInvalidInterval is returned when interval validation fails.
	ErrInvalidInterval = errors.New("unsupported interval: supported values are 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M")
	// ErrEmptyInterval is returned when interval is empty.
	ErrEmptyInterval = errors.New("interval cannot be empty")
)

// Interval is a value object representing a data interval.
// Immutable - use NewInterval to create validated instances.
type Interval string

const (
	Interval1m  Interval = "1m"
	Interval5m  Interval = "5m"
	Interval15m Interval = "15m"
	Interval30m Interval = "30m"
	Interval1H  Interval = "1H"
	Interval4H  Interval = "4H"
	Interval1D  Interval = "1D"
	Interval1W  Interval = "1W"
	Interval1M  Interval = "1M"
)

// NewInterval creates a validated Interval.
func NewInterval(value string) (Interval, error) {
	if value == "" {
		return "", ErrEmptyInterval
	}

	normalized := strings.TrimSpace(value)
	i := Interval(normalized)

	switch i {
	case Interval1m, Interval5m, Interval15m, Interval30m,
		Interval1H, Interval4H, Interval1D, Interval1W, Interval1M:
		return i, nil
	default:
		return "", ErrInvalidInterval
	}
}
