package divergence

import (
	"fmt"
	"sort"

	"bot-trade/domain/aggregate/analysis"
)

// analyzeDivergence checks for divergence patterns between price and RSI pivots.
func (d *Detector) analyzeDivergence(
	nodes []priceRSINode,
	pivots []pivot,
	divergenceType analysis.DivergenceType,
) *analysis.DivergenceResult {
	if len(nodes) == 0 {
		return analysis.NewNoDivergenceResult(0, 0)
	}

	currentPrice := nodes[len(nodes)-1].price
	currentRSI := nodes[len(nodes)-1].rsi

	if len(pivots) < 2 {
		return analysis.NewNoDivergenceResult(currentPrice, currentRSI)
	}

	// Sort by index descending (most recent first)
	sortPivotsByIndexDesc(pivots)

	// Check consecutive pivot pairs for divergence
	for i := 0; i < len(pivots)-1; i++ {
		current := pivots[i]
		previous := pivots[i+1]

		if !d.isValidPivotDistance(current, previous) {
			continue
		}

		if d.isDivergence(current, previous, divergenceType) {
			return d.createDivergenceResult(current, previous, divergenceType, currentPrice, currentRSI)
		}
	}

	return analysis.NewNoDivergenceResult(currentPrice, currentRSI)
}

func sortPivotsByIndexDesc(pivots []pivot) {
	sort.Slice(pivots, func(i, j int) bool {
		return pivots[i].index > pivots[j].index
	})
}

func (d *Detector) isValidPivotDistance(current, previous pivot) bool {
	barsBetween := current.index - previous.index
	return barsBetween >= d.config.RangeMin() && barsBetween <= d.config.RangeMax()
}

func (d *Detector) isDivergence(current, previous pivot, divergenceType analysis.DivergenceType) bool {
	if divergenceType == analysis.BullishDivergence {
		// Bullish: Price Lower Low + RSI Higher Low
		priceLL := current.price < previous.price
		rsiHL := current.rsi > previous.rsi
		return priceLL && rsiHL
	}

	// Bearish: Price Higher High + RSI Lower High
	priceHH := current.price > previous.price
	rsiLH := current.rsi < previous.rsi
	return priceHH && rsiLH
}

func (d *Detector) createDivergenceResult(
	current, previous pivot,
	divergenceType analysis.DivergenceType,
	currentPrice, currentRSI float64,
) *analysis.DivergenceResult {
	label := "Bullish"
	if divergenceType == analysis.BearishDivergence {
		label = "Bearish"
	}

	description := fmt.Sprintf(
		"%s: Price %.2f->%.2f, RSI %.2f->%.2f, Date %s->%s",
		label, previous.price, current.price, previous.rsi, current.rsi,
		previous.date, current.date,
	)

	return analysis.NewDivergenceResult(true, divergenceType, currentPrice, currentRSI, description)
}
