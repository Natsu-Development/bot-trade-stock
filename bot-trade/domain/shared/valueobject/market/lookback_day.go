// Package market provides shared immutable value objects for market and trading bounded contexts.
package market

import "errors"

var (
	// ErrInvalidLookbackDay is returned when LookbackDay is outside valid range.
	ErrInvalidLookbackDay = errors.New("lookback day must be between 1 and 365")
)

// LookbackDay represents the number of days of historical data to fetch for analysis.
// Used to calculate start date: time.Now().AddDate(0, 0, -int(LookbackDay))
type LookbackDay int

const (
	MinLookbackDay LookbackDay = 1
	MaxLookbackDay LookbackDay = 365
)

// NewLookbackDay creates a validated LookbackDay.
func NewLookbackDay(value int) (LookbackDay, error) {
	if value < int(MinLookbackDay) || value > int(MaxLookbackDay) {
		return 0, ErrInvalidLookbackDay
	}
	return LookbackDay(value), nil
}
