// Package service provides domain services for technical analysis.
package service

import (
	"bot-trade/domain/analysis/valueobject"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// findSliceIndex finds the starting slice position after a given pivot index.
// Returns (startPosition, true) if pivot exists and has bars after it.
// Returns (0, false) if pivot not found or is the last bar.
func findSliceIndex(data []marketvo.MarketData, pivotIndex int) (int, bool) {
	for i, bar := range data {
		if bar.Index == pivotIndex {
			// Found pivot - return position after it
			if i+1 < len(data) {
				return i + 1, true
			}
			// Pivot is the last bar - nothing to check
			return 0, false
		}
	}
	// Pivot not in this slice
	return 0, false
}

// findCrossingPointAbove finds the first bar where price crossed above the trendline.
func findCrossingPointAbove(
	data []marketvo.MarketData,
	line valueobject.Trendline,
) valueobject.CrossingPoint {
	startPos, valid := findSliceIndex(data, line.EndPivot.Index)
	if !valid {
		return valueobject.NotFoundCrossing()
	}

	for i := startPos; i < len(data); i++ {
		bar := data[i]
		linePrice := line.PriceAt(bar.Index)

		if bar.Close > linePrice {
			return valueobject.NewCrossingPoint(bar.Date, bar.Close)
		}
	}

	return valueobject.NotFoundCrossing()
}

// findCrossingPointBelow finds the first bar where price crossed below the trendline.
func findCrossingPointBelow(
	data []marketvo.MarketData,
	line valueobject.Trendline,
) valueobject.CrossingPoint {
	startPos, valid := findSliceIndex(data, line.EndPivot.Index)
	if !valid {
		return valueobject.NotFoundCrossing()
	}

	for i := startPos; i < len(data); i++ {
		bar := data[i]
		linePrice := line.PriceAt(bar.Index)

		if bar.Close < linePrice {
			return valueobject.NewCrossingPoint(bar.Date, bar.Close)
		}
	}

	return valueobject.NotFoundCrossing()
}

// GenerateSupportSignals creates bounce signals from support trendlines.
func GenerateSupportSignals(
	trendlines []valueobject.Trendline,
	dataRecent []marketvo.MarketData,
	proximityPercent float64,
) []valueobject.Signal {
	var signals []valueobject.Signal

	currentPrice := dataRecent[len(dataRecent)-1].Close
	currentDate := dataRecent[len(dataRecent)-1].Date
	currentIndex := dataRecent[len(dataRecent)-1].Index

	for _, line := range trendlines {
		var crossing valueobject.CrossingPoint
		crossing = findCrossingPointBelow(dataRecent, line)

		if crossing.Found {
			linePrice := line.PriceAt(currentIndex)
			signals = append(signals, valueobject.Signal{
				Type:      valueobject.BounceConfirmed,
				Price:     crossing.Price,
				Time:      crossing.Date,
				PriceLine: linePrice,
			})
			continue
		}

		linePrice := line.PriceAt(currentIndex)
		distance := (currentPrice - linePrice) / linePrice

		if distance >= -proximityPercent && distance <= proximityPercent {
			signals = append(signals, valueobject.Signal{
				Type:      valueobject.BouncePotential,
				Price:     currentPrice,
				Time:      currentDate,
				PriceLine: linePrice,
			})
		}
	}

	return signals
}

// GenerateResistanceSignals creates breakout signals from resistance trendlines.
func GenerateResistanceSignals(
	trendlines []valueobject.Trendline,
	dataRecent []marketvo.MarketData,
	proximityPercent float64,
) []valueobject.Signal {
	var signals []valueobject.Signal

	currentPrice := dataRecent[len(dataRecent)-1].Close
	currentDate := dataRecent[len(dataRecent)-1].Date
	currentIndex := dataRecent[len(dataRecent)-1].Index

	for _, line := range trendlines {
		var crossing valueobject.CrossingPoint
		crossing = findCrossingPointAbove(dataRecent, line)

		if crossing.Found {
			linePrice := line.PriceAt(currentIndex)
			signals = append(signals, valueobject.Signal{
				Type:      valueobject.BreakoutConfirmed,
				Price:     crossing.Price,
				Time:      crossing.Date,
				PriceLine: linePrice,
			})
			continue
		}

		linePrice := line.PriceAt(currentIndex)
		distance := (currentPrice - linePrice) / linePrice

		if distance >= -proximityPercent && distance <= proximityPercent {
			signals = append(signals, valueobject.Signal{
				Type:      valueobject.BreakoutPotential,
				Price:     currentPrice,
				Time:      currentDate,
				PriceLine: linePrice,
			})
		}
	}

	return signals
}
