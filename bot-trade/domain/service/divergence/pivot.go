package divergence

import "bot-trade/domain/aggregate/market"

// priceRSINode represents a data point with price and RSI value.
type priceRSINode struct {
	index int
	date  string
	price float64
	rsi   float64
}

// pivot represents a detected pivot point (high or low) in RSI data.
type pivot struct {
	index int
	price float64
	rsi   float64
	date  string
}

// createNodes builds a slice of price-RSI nodes from raw data.
func (d *Detector) createNodes(priceHistory []*market.PriceData, rsiValues []float64) []priceRSINode {
	minLen := len(priceHistory)
	if len(rsiValues) < minLen {
		minLen = len(rsiValues)
	}

	nodes := make([]priceRSINode, minLen)
	for i := 0; i < minLen; i++ {
		nodes[i] = priceRSINode{
			index: i,
			date:  priceHistory[i].Date(),
			price: priceHistory[i].Close().Value(),
			rsi:   rsiValues[i],
		}
	}
	return nodes
}

// findPivotHighs detects RSI pivot highs (peaks).
func (d *Detector) findPivotHighs(nodes []priceRSINode) []pivot {
	return d.findPivots(nodes, d.isPivotHigh)
}

// findPivotLows detects RSI pivot lows (troughs).
func (d *Detector) findPivotLows(nodes []priceRSINode) []pivot {
	return d.findPivots(nodes, d.isPivotLow)
}

func (d *Detector) findPivots(nodes []priceRSINode, isPivot func([]priceRSINode, int) bool) []pivot {
	var pivots []pivot
	minRequired := d.config.LookbackLeft() + d.config.LookbackRight() + 1

	if len(nodes) < minRequired {
		return pivots
	}

	for i := d.config.LookbackLeft(); i < len(nodes); i++ {
		if isPivot(nodes, i) {
			pivots = append(pivots, pivot{
				index: i,
				price: nodes[i].price,
				rsi:   nodes[i].rsi,
				date:  nodes[i].date,
			})
		}
	}
	return pivots
}

// isPivotHigh checks if the RSI at index is higher than surrounding values.
func (d *Detector) isPivotHigh(nodes []priceRSINode, index int) bool {
	centerRSI := nodes[index].rsi
	rightIndex := min(index+d.config.LookbackRight(), len(nodes)-1)

	// Check left side
	for i := index - d.config.LookbackLeft(); i < index; i++ {
		if nodes[i].rsi >= centerRSI {
			return false
		}
	}

	// Check right side
	for i := index + 1; i <= rightIndex; i++ {
		if nodes[i].rsi >= centerRSI {
			return false
		}
	}

	return true
}

// isPivotLow checks if the RSI at index is lower than surrounding values.
func (d *Detector) isPivotLow(nodes []priceRSINode, index int) bool {
	centerRSI := nodes[index].rsi
	rightIndex := min(index+d.config.LookbackRight(), len(nodes)-1)

	// Check left side
	for i := index - d.config.LookbackLeft(); i < index; i++ {
		if nodes[i].rsi <= centerRSI {
			return false
		}
	}

	// Check right side
	for i := index + 1; i <= rightIndex; i++ {
		if nodes[i].rsi <= centerRSI {
			return false
		}
	}

	return true
}
