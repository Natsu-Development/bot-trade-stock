package valueobjects

import (
	"errors"
)

type Interval struct {
	interval string
}

// Supported intervals
var supportedIntervals = map[string]bool{
	"1m":  true, // 1 minute
	"5m":  true, // 5 minutes
	"15m": true, // 15 minutes
	"30m": true, // 30 minutes
	"1H":  true, // 1 hour
	"4H":  true, // 4 hours
	"1D":  true, // 1 day (default)
	"1W":  true, // 1 week
	"1M":  true, // 1 month
}

// NewDataInterval creates a new data interval with validation
func NewDataInterval(interval string) (*Interval, error) {
	// Default to daily if empty
	if interval == "" {
		interval = "1D"
	}

	// Check if supported
	if !supportedIntervals[interval] {
		return nil, errors.New("unsupported interval: supported values are 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M")
	}

	return &Interval{interval: interval}, nil

}

// Value returns the interval value
func (di *Interval) Value() string {
	return di.interval
}
