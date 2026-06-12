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

// FetchSpanDays is a calendar-day window of historical data to fetch for analysis.
type FetchSpanDays int

// FetchSpanForBars converts a desired bar count into the calendar-day fetch span
// needed to obtain it for the given interval (bars × daysPerBar). Pure — no I/O,
// no cap. A daily-tuned bar count would otherwise return too few weekly/monthly
// bars and starve the RSI / pivot / divergence pipeline; daysPerBar holds the
// per-interval scaling factors.
func FetchSpanForBars(i Interval, bars int) FetchSpanDays {
	return FetchSpanDays(float64(bars) * daysPerBar(i))
}

// daysPerBar returns the calendar-days-of-fetch headroom factor per requested bar
// for the given interval. It is NOT a literal bar span — it converts a desired
// bar count into the calendar-day window needed to fetch at least that many bars.
// Used by FetchSpanForBars to size fetch windows correctly across cadences.
//
// For daily bars the factor is the trading-days-per-calendar-day ratio
// (~252/365 ≈ 1.45) plus a small holiday cushion, rounded to 1.5: fetching N
// daily bars requires ~1.5N calendar days of history. Weekly (7.0) and monthly
// (30.0) use the literal calendar span of one bar. Intraday intervals are treated
// as identity (1.0) — their bars are sub-daily, so a calendar-day window already
// over-provisions them.
func daysPerBar(i Interval) float64 {
	switch i {
	case Interval1D:
		return 1.5
	case Interval1W:
		return 7.0
	case Interval1M:
		return 30.0
	default:
		return 1.0 // all intraday: identity
	}
}
