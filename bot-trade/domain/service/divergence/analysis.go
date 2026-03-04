package divergence

import (
	"fmt"
	"sort"

	"bot-trade/domain/aggregate/analysis"
)

// analyze checks for divergence patterns between price and RSI pivot points.
func (d *Detector) analyze(pivots []DetectionPivotPoint, divergenceType analysis.DivergenceType) DetectionResult {
	if len(pivots) < 2 {
		return DetectionResult{Found: false, Type: analysis.NoDivergence}
	}

	// Sort pivots by index descending (most recent first)
	sort.Slice(pivots, func(i, j int) bool {
		return pivots[i].Index > pivots[j].Index
	})

	// Check adjacent pivot pairs for divergence
	for i := 0; i < len(pivots)-1; i++ {
		current := pivots[i]
		previous := pivots[i+1]

		barsBetween := current.Index - previous.Index
		if barsBetween < d.config.RangeMin || barsBetween > d.config.RangeMax {
			continue
		}

		if d.isDivergence(current, previous, divergenceType) {
			return d.createResult(current, previous, divergenceType)
		}
	}

	return DetectionResult{Found: false, Type: analysis.NoDivergence}
}

func (d *Detector) isDivergence(current, previous DetectionPivotPoint, divergenceType analysis.DivergenceType) bool {
	if divergenceType == analysis.BullishDivergence {
		// Bullish: Price makes Lower Low, RSI makes Higher Low
		return current.Price < previous.Price && current.RSI > previous.RSI
	}
	// Bearish: Price makes Higher High, RSI makes Lower High
	return current.Price > previous.Price && current.RSI < previous.RSI
}

func (d *Detector) createResult(current, previous DetectionPivotPoint, divergenceType analysis.DivergenceType) DetectionResult {
	label := "Bullish"
	if divergenceType == analysis.BearishDivergence {
		label = "Bearish"
	}

	return DetectionResult{
		Found: true,
		Type:  divergenceType,
		Description: fmt.Sprintf(
			"%s: Price %.2f->%.2f, RSI %.2f->%.2f, Date %s->%s",
			label, previous.Price, current.Price, previous.RSI, current.RSI,
			previous.Date, current.Date,
		),
		PivotPoints: []DetectionPivotPoint{
			{Price: previous.Price, RSI: previous.RSI, Date: previous.Date, Index: previous.Index}, // FROM (older)
			{Price: current.Price, RSI: current.RSI, Date: current.Date, Index: current.Index},    // TO (newer)
		},
	}
}
