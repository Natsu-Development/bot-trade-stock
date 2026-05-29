// Package market provides shared immutable value objects for market and trading bounded contexts.
package market

import "errors"

var (
	// ErrInvalidLookbackDay is returned when LookbackDay is outside valid range.
	ErrInvalidLookbackDay = errors.New("lookback day must be between 1 and 12000")
)

// LookbackDay represents the number of days of historical data to fetch for analysis.
// Used to calculate start date: time.Now().AddDate(0, 0, -int(LookbackDay))
type LookbackDay int

const (
	MinLookbackDay LookbackDay = 1
	// MaxLookbackDay bounds user-input LookbackDay. 12000 ≈ 33 years of daily input —
	// well above any realistic config, well below memory-bomb territory. Accommodates
	// scaled monthly windows up to LookbackDay=400 (1M × 30 = 12000 calendar days) via
	// EffectiveLookbackDays in scaling.go. The same constant is re-asserted by
	// calculateDateRange (query.go:64-66) on the resolved date window.
	MaxLookbackDay LookbackDay = 12000
)

// NewLookbackDay creates a validated LookbackDay.
func NewLookbackDay(value int) (LookbackDay, error) {
	if value < int(MinLookbackDay) || value > int(MaxLookbackDay) {
		return 0, ErrInvalidLookbackDay
	}
	return LookbackDay(value), nil
}
