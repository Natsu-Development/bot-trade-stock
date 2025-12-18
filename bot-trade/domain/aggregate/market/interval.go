package market

import "errors"

// Interval is a value object representing a data interval.
type Interval string

// Supported intervals.
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
