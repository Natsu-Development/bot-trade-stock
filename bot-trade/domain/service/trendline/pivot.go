package trendline

import (
	"sort"

	"bot-trade/domain/aggregate/market"
)

// findPricePivots is the shared implementation for pivot detection.
// getField selects which price field to compare (High for highs, Low for lows).
// exceeds returns true when a neighbor's value disqualifies the center as a pivot
// (e.g. neighbor >= center for highs, neighbor <= center for lows).
func (d *Detector) findPricePivots(
	prices []*market.PriceData,
	pivotLength int,
	getField func(*market.PriceData) float64,
	exceeds func(neighbor, center float64) bool,
) []PricePivot {
	minRequired := pivotLength*2 + 1
	if len(prices) < minRequired {
		return nil
	}

	var pivots []PricePivot
	for i := pivotLength; i < len(prices)-pivotLength; i++ {
		centerVal := getField(prices[i])
		isExtreme := true

		for j := i - pivotLength; j < i && isExtreme; j++ {
			if exceeds(getField(prices[j]), centerVal) {
				isExtreme = false
			}
		}

		for j := i + 1; j <= i+pivotLength && isExtreme; j++ {
			if exceeds(getField(prices[j]), centerVal) {
				isExtreme = false
			}
		}

		if isExtreme {
			pivots = append(pivots, PricePivot{
				Index: i,
				High:  prices[i].High,
				Low:   prices[i].Low,
				Close: prices[i].Close,
				Date:  prices[i].Date,
			})
		}
	}

	return pivots
}

// findPricePivotHighs detects pivot highs based on price.
// A pivot high is confirmed when a bar's high is higher than all bars
// in the lookback windows to both left and right.
// Uses Pine Script style: single pivotLength for both left and right.
func (d *Detector) findPricePivotHighs(prices []*market.PriceData, pivotLength int) []PricePivot {
	return d.findPricePivots(prices, pivotLength,
		func(p *market.PriceData) float64 { return p.High },
		func(neighbor, center float64) bool { return neighbor >= center },
	)
}

// findPricePivotLows detects pivot lows based on price.
// A pivot low is confirmed when a bar's low is lower than all bars
// in the lookback windows to both left and right.
// Uses Pine Script style: single pivotLength for both left and right.
func (d *Detector) findPricePivotLows(prices []*market.PriceData, pivotLength int) []PricePivot {
	return d.findPricePivots(prices, pivotLength,
		func(p *market.PriceData) float64 { return p.Low },
		func(neighbor, center float64) bool { return neighbor <= center },
	)
}

// sortByIndex sorts pivots by index in ascending order.
func sortByIndex(pivots []PricePivot) {
	sort.Slice(pivots, func(i, j int) bool {
		return pivots[i].Index < pivots[j].Index
	})
}

// createUptrendLinesPineStyle creates uptrend support lines using Pine Script logic.
// For each pivot low, if the previous low is lower, create a trendline.
//
// Pine Script logic:
// if pl  // new pivot low
//
//	utlX1 := utlX2, utlY1 := utlY2  // shift previous
//	utlX2 := bar_index[pivLen], utlY2 := low[pivLen]  // store new
//	if utlY1 < utlY2  // ascending (previous low < new low)
//	    createLine('pl', utlX1, utlY1, utlX2, utlY2)
func (d *Detector) createUptrendLinesPineStyle(pivotLows []PricePivot, currentIndex int) []Trendline {
	if len(pivotLows) < 2 {
		return nil
	}

	// Ensure pivots are sorted by index
	sortByIndex(pivotLows)

	var lines []Trendline

	// Track state like Pine Script: keep references to the actual pivot structs
	var prevPivot *PricePivot
	var hasPrevious bool

	for _, pivot := range pivotLows {
		if !hasPrevious {
			// First pivot - store as previous
			prevPivot = &pivot
			hasPrevious = true
			continue
		}

		// Pine Script: if utlY1 < utlY2 (previous low is lower than new low = ascending)
		// This creates an uptrend support line
		if prevPivot.Low < pivot.Low {
			line := d.calculateTrendlinePineStyle(
				*prevPivot,
				pivot,
				UptrendSupport,
			)
			if line.IsValid {
				lines = append(lines, line)
			}
		}

		// Update previous pivot to current
		prevPivot = &pivot
	}

	return lines
}

// createDowntrendLinesPineStyle creates downtrend resistance lines using Pine Script logic.
// For each pivot high, if the previous high is higher, create a trendline.
//
// Pine Script logic:
// if ph  // new pivot high
//
//	dtlX1 := dtlX2, dtlY1 := dtlY2  // shift previous
//	dtlX2 := bar_index[pivLen], dtlY2 := high[pivLen]  // store new
//	if dtlY1 > dtlY2  // descending (previous high > new high)
//	    createLine('ph', dtlX1, dtlY1, dtlX2, dtlY2)
func (d *Detector) createDowntrendLinesPineStyle(pivotHighs []PricePivot, currentIndex int) []Trendline {
	if len(pivotHighs) < 2 {
		return nil
	}

	// Ensure pivots are sorted by index
	sortByIndex(pivotHighs)

	var lines []Trendline

	// Track state like Pine Script: keep references to the actual pivot structs
	var prevPivot *PricePivot
	var hasPrevious bool

	for _, pivot := range pivotHighs {
		if !hasPrevious {
			// First pivot - store as previous
			prevPivot = &pivot
			hasPrevious = true
			continue
		}

		// Pine Script: if dtlY1 > dtlY2 (previous high is higher than new high = descending)
		// This creates a downtrend resistance line
		if prevPivot.High > pivot.High {
			line := d.calculateTrendlinePineStyle(
				*prevPivot,
				pivot,
				DowntrendResistance,
			)
			if line.IsValid {
				lines = append(lines, line)
			}
		}

		// Update previous pivot to current
		prevPivot = &pivot
	}

	return lines
}
