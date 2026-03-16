// Package service provides domain services for technical analysis.
package service

import (
	"sort"

	analysisvo "bot-trade/domain/analysis/valueobject"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// FindBullishDivergences detects bullish divergence patterns (Price LL, RSI HL).
// Pure function - returns Divergence value objects directly.
//
// Parameters:
//   - pivots: Pivot points to analyze (should be sorted by index, ideally descending)
//   - rangeMin: Minimum bars between pivots
//   - rangeMax: Maximum bars between pivots
//
// Returns: Slice of detected bullish divergences.
func FindBullishDivergences(
	pivots []marketvo.MarketData,
	rangeMin, rangeMax int,
) []analysisvo.Divergence {
	// Sort pivots descending (newer first) for proper iteration
	pivots = sortDescending(pivots)

	var results []analysisvo.Divergence

	if len(pivots) < 2 {
		return results
	}

	// Check adjacent pivot pairs
	for i := 0; i < len(pivots)-1; i++ {
		current := pivots[i]
		previous := pivots[i+1]

		barsBetween := current.Index - previous.Index
		if barsBetween < rangeMin || barsBetween > rangeMax {
			continue
		}

		// Bullish: Price makes Lower Low, RSI makes Higher Low
		if current.Low < previous.Low && current.RSI > previous.RSI {
			results = append(results, analysisvo.Divergence{
				Type:        analysisvo.BullishDivergence,
				FirstPivot:  previous,
				SecondPivot: current,
				IsEarly:     false,
			})
		}
	}

	return results
}

// FindBearishDivergences detects bearish divergence patterns (Price HH, RSI LH).
// Pure function - returns Divergence value objects directly.
//
// Parameters:
//   - pivots: Pivot points to analyze (should be sorted by index, ideally descending)
//   - rangeMin: Minimum bars between pivots
//   - rangeMax: Maximum bars between pivots
//
// Returns: Slice of detected bearish divergences.
func FindBearishDivergences(
	pivots []marketvo.MarketData,
	rangeMin, rangeMax int,
) []analysisvo.Divergence {
	// Sort pivots descending (newer first) for proper iteration
	pivots = sortDescending(pivots)

	var results []analysisvo.Divergence

	if len(pivots) < 2 {
		return results
	}

	// Check adjacent pivot pairs
	for i := 0; i < len(pivots)-1; i++ {
		current := pivots[i]
		previous := pivots[i+1]

		barsBetween := current.Index - previous.Index
		if barsBetween < rangeMin || barsBetween > rangeMax {
			continue
		}

		// Bearish: Price makes Higher High, RSI makes Lower High
		if current.High > previous.High && current.RSI < previous.RSI {
			results = append(results, analysisvo.Divergence{
				Type:        analysisvo.BearishDivergence,
				FirstPivot:  previous,
				SecondPivot: current,
				IsEarly:     false,
			})
		}
	}

	return results
}

// FindEarlyBearishDivergence detects forming bearish divergence using the current bar.
// This is for early signal detection before the second pivot is confirmed.
//
// Parameters:
//   - pivots: Confirmed pivot points (most recent first)
//   - currentData: Current market data bar
//
// Returns: Early bearish divergence (IsEarly=true) if detected, zero value otherwise.
func FindEarlyBearishDivergence(
	pivots []marketvo.MarketData,
	currentData marketvo.MarketData,
) analysisvo.Divergence {
	if len(pivots) == 0 || !currentData.HasRSI() {
		return analysisvo.Divergence{}
	}

	lastPivot := pivots[0]

	// Bearish: Price makes Higher High, RSI makes Lower High
	if currentData.High > lastPivot.High && currentData.RSI < lastPivot.RSI {
		return analysisvo.Divergence{
			Type:        analysisvo.BearishDivergence,
			FirstPivot:  lastPivot,
			SecondPivot: currentData,
			IsEarly:     true,
		}
	}

	return analysisvo.Divergence{}
}

// sortDescending sorts pivots by index in descending order (newer pivots first).
// Required for divergence detection which processes most recent pivots first.
func sortDescending(pivots []marketvo.MarketData) []marketvo.MarketData {
	sort.Slice(pivots, func(i, j int) bool {
		return pivots[i].Index > pivots[j].Index
	})
	return pivots
}
