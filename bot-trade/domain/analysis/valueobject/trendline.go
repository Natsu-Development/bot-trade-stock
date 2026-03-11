// Package valueobject contains value objects for technical analysis.
package valueobject

import (
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// LineType represents whether a trendline is support or resistance.
type LineType string

const (
	UptrendSupport      LineType = "uptrend_support"      // Connects pivot lows, acts as support/floor
	DowntrendResistance LineType = "downtrend_resistance" // Connects pivot highs, acts as resistance/ceiling
)

// IsSupport returns true if this is a support line.
func (lt LineType) IsSupport() bool {
	return lt == UptrendSupport
}

// IsResistance returns true if this is a resistance line.
func (lt LineType) IsResistance() bool {
	return lt == DowntrendResistance
}

// priceFor returns the appropriate price based on trendline type.
// For support lines: returns Low price
// For resistance lines: returns High price
func priceFor(lineType LineType, data marketvo.MarketData) float64 {
	if lineType.IsSupport() {
		return data.Low
	}
	return data.High
}

// Trendline is a value object representing a detected trendline.
// It connects two pivot points and can calculate prices at any index.
type Trendline struct {
	StartPivot marketvo.MarketData
	EndPivot   marketvo.MarketData
	Slope      float64 // Price change per bar
	Intercept  float64 // Y-intercept for linear price calculation
	Type       LineType
}

// NewTrendline creates a new Trendline value object from two pivots.
func NewTrendline(start, end marketvo.MarketData, lineType LineType) Trendline {
	startPrice := priceFor(lineType, start)
	endPrice := priceFor(lineType, end)

	startIndex := start.Index
	endIndex := end.Index

	// Calculate slope: (y2 - y1) / (x2 - x1)
	var slope float64
	if endIndex != startIndex {
		slope = (endPrice - startPrice) / float64(endIndex-startIndex)
	}

	// Calculate intercept: b = y - mx
	intercept := startPrice - slope*float64(startIndex)

	return Trendline{
		StartPivot: start,
		EndPivot:   end,
		Slope:      slope,
		Intercept:  intercept,
		Type:       lineType,
	}
}

// PriceAt calculates the trendline price at a given index using linear scale.
func (t *Trendline) PriceAt(index int) float64 {
	return t.Intercept + float64(index)*t.Slope
}

// StartPrice returns the price at the start pivot (Low for support, High for resistance)
func (t *Trendline) StartPrice() float64 {
	return priceFor(t.Type, t.StartPivot)
}

// EndPrice returns the price at the end pivot (Low for support, High for resistance)
func (t *Trendline) EndPrice() float64 {
	return priceFor(t.Type, t.EndPivot)
}
