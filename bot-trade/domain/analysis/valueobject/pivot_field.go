// Package valueobject contains value objects for technical analysis.
package valueobject

import (
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// PivotField specifies which value to use for pivot detection.
type PivotField int

const (
	FieldHigh  PivotField = iota // Use price High
	FieldLow                     // Use price Low
	FieldClose                   // Use price Close
	FieldRSI                     // Use RSI value
)

// ValueFrom extracts the field value from MarketData.
// Returns the corresponding value (High, Low, Close, or RSI) for this field type.
func (pf PivotField) ValueFrom(data marketvo.MarketData) float64 {
	switch pf {
	case FieldHigh:
		return data.High
	case FieldLow:
		return data.Low
	case FieldClose:
		return data.Close
	case FieldRSI:
		return data.RSI
	default:
		return 0
	}
}
