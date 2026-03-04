// Package pivot provides pivot detection for finding local extrema.
package pivot

// PivotField specifies which value to use for pivot detection.
type PivotField int

const (
	FieldHigh  PivotField = iota // Use price High
	FieldLow                      // Use price Low
	FieldClose                    // Use price Close
	FieldRSI                      // Use RSI value
)

// PivotPoint represents a detected pivot point with full OHLC + RSI data.
// This unified type eliminates the need for separate rsiPivot and PricePivot types.
type PivotPoint struct {
	Index int     // Position in the data series
	Date  string  // Trading date

	// Price data (from High/Low for trendline detection)
	High  float64
	Low   float64
	Close float64
	Price float64 // Alias for Close, for backward compatibility with divergence detection

	// RSI data (for divergence detection)
	RSI float64
}
