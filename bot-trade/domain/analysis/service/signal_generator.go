// Package service provides domain services for technical analysis.
package service

import (
	"bot-trade/domain/analysis/valueobject"
)

// GenerateSupportSignals creates bounce signals from support trendlines.
// Pure function - returns slice of Signal value objects.
//
// Parameters:
//   - trendlines: Support trendlines to analyze for signals
//   - currentPrice: Current market price
//   - currentDate: Current bar date
//   - proximityPercent: Percentage distance from price to trendline for signal generation
//   - currentIndex: Current bar index for linear extension calculation
//
// Returns: Slice of detected bounce signals (BounceConfirmed, BouncePotential).
func GenerateSupportSignals(
	trendlines []valueobject.Trendline,
	currentPrice float64,
	currentDate string,
	proximityPercent float64,
	currentIndex int,
) []valueobject.Signal {
	var signals []valueobject.Signal

	for _, line := range trendlines {
		linePrice := line.PriceAt(currentIndex)
		distance := (currentPrice - linePrice) / linePrice

		// Price crossed above the support line (bounce confirmed)
		if distance > proximityPercent {
			signals = append(signals, valueobject.Signal{
				Type:      valueobject.BounceConfirmed,
				Price:     currentPrice,
				Time:      currentDate,
				Trendline: &line,
				Source:    "trendline",
			})
			continue
		}

		// Price is on the support line (bounce potential)
		if distance >= -proximityPercent && distance <= proximityPercent {
			signals = append(signals, valueobject.Signal{
				Type:      valueobject.BouncePotential,
				Price:     currentPrice,
				Time:      currentDate,
				Trendline: &line,
				Source:    "trendline",
			})
		}
	}

	return signals
}

// GenerateResistanceSignals creates breakout signals from resistance trendlines.
// Pure function - returns slice of Signal value objects.
//
// Parameters:
//   - trendlines: Resistance trendlines to analyze for signals
//   - currentPrice: Current market price
//   - currentDate: Current bar date
//   - proximityPercent: Percentage distance from price to trendline for signal generation
//   - currentIndex: Current bar index for linear extension calculation
//
// Returns: Slice of detected breakout signals (BreakoutConfirmed, BreakoutPotential).
func GenerateResistanceSignals(
	trendlines []valueobject.Trendline,
	currentPrice float64,
	currentDate string,
	proximityPercent float64,
	currentIndex int,
) []valueobject.Signal {
	var signals []valueobject.Signal

	for _, line := range trendlines {
		linePrice := line.PriceAt(currentIndex)
		distance := (currentPrice - linePrice) / linePrice

		// Price crossed above the resistance line (breakout confirmed)
		if distance > proximityPercent {
			signals = append(signals, valueobject.Signal{
				Type:      valueobject.BreakoutConfirmed,
				Price:     currentPrice,
				Time:      currentDate,
				Trendline: &line,
				Source:    "trendline",
			})
			continue
		}

		// Price is on the resistance line (breakout potential)
		if distance >= -proximityPercent && distance <= proximityPercent {
			signals = append(signals, valueobject.Signal{
				Type:      valueobject.BreakoutPotential,
				Price:     currentPrice,
				Time:      currentDate,
				Trendline: &line,
				Source:    "trendline",
			})
		}
	}

	return signals
}
