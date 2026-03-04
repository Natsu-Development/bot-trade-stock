// Package pivot provides pivot detection for finding local extrema.
package pivot

import (
	"bot-trade/domain/aggregate/market"
)

// Finder finds pivots in a data series.
type Finder struct {
	lookback int // Bars on each side to check for pivot confirmation
}

// NewFinder creates a new pivot finder.
func NewFinder(lookback int) *Finder {
	return &Finder{lookback: lookback}
}

// FindHighs detects pivot highs (peaks) in market data based on the specified field.
// A pivot high occurs when no value within lookback bars is greater than the center.
func (f *Finder) FindHighs(data []market.MarketData, field PivotField) []PivotPoint {
	return f.findPivots(data, field, true)
}

// FindLows detects pivot lows (troughs) in market data based on the specified field.
// A pivot low occurs when no value within lookback bars is less than the center.
func (f *Finder) FindLows(data []market.MarketData, field PivotField) []PivotPoint {
	return f.findPivots(data, field, false)
}

// findPivots detects pivot points in market data.
// findHighs=true: pivot high when no neighbor is greater
// findHighs=false: pivot low when no neighbor is less
func (f *Finder) findPivots(data []market.MarketData, field PivotField, findHighs bool) []PivotPoint {
	minRequired := f.lookback*2 + 1
	if len(data) < minRequired {
		return nil
	}

	var pivots []PivotPoint
	start := f.lookback
	end := len(data) - f.lookback

	for i := start; i < end; i++ {
		center := f.getFieldValue(data, i, field)
		if center == 0 {
			continue
		}

		if f.isPivot(data, i, center, field, findHighs) {
			pivots = append(pivots, PivotPoint{
				Index: i,
				Date:  data[i].Date,
				High:  data[i].High,
				Low:   data[i].Low,
				Close: data[i].Close,
				Price: data[i].Close,
				RSI:   data[i].RSI,
			})
		}
	}

	return pivots
}

// getFieldValue returns the value for the specified field at index i.
func (f *Finder) getFieldValue(data []market.MarketData, i int, field PivotField) float64 {
	if i < 0 || i >= len(data) {
		return 0
	}

	switch field {
	case FieldHigh:
		return data[i].High
	case FieldLow:
		return data[i].Low
	case FieldClose:
		return data[i].Close
	case FieldRSI:
		return data[i].RSI
	default:
		return 0
	}
}

// isPivot checks if index i is a pivot point.
func (f *Finder) isPivot(data []market.MarketData, i int, center float64, field PivotField, findHighs bool) bool {
	// Check left side
	for j := i - f.lookback; j < i; j++ {
		neighbor := f.getFieldValue(data, j, field)
		if neighbor != 0 && f.disqualifies(neighbor, center, findHighs) {
			return false
		}
	}

	// Check right side
	for j := i + 1; j <= i+f.lookback; j++ {
		neighbor := f.getFieldValue(data, j, field)
		if neighbor != 0 && f.disqualifies(neighbor, center, findHighs) {
			return false
		}
	}

	return true
}

// disqualifies returns true if neighbor disqualifies center as a pivot.
func (f *Finder) disqualifies(neighbor, center float64, findHighs bool) bool {
	if findHighs {
		return neighbor >= center // For highs: neighbor must be less
	}
	return neighbor <= center // For lows: neighbor must be greater
}
