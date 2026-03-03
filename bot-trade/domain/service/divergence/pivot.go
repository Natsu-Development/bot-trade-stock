package divergence

import "bot-trade/domain/aggregate/market"

// pivot represents a detected pivot point in RSI data.
type pivot struct {
	index int
	price float64
	rsi   float64
	date  string
}

// pivotComparator returns true when a neighbor's RSI value disqualifies the
// center bar as a pivot (e.g. neighbor >= center for highs, <= center for lows).
type pivotComparator func(neighbor, center float64) bool

// findPivots is the shared implementation for RSI pivot detection.
// cmp defines the extremity condition for highs vs lows.
func (d *Detector) findPivots(data []market.PriceDataWithRSI, cmp pivotComparator) []pivot {
	minRequired := d.config.LookbackLeft + d.config.LookbackRight + 1
	if len(data) < minRequired {
		return nil
	}

	var pivots []pivot
	for i := d.config.LookbackLeft; i < len(data)-d.config.LookbackRight; i++ {
		if data[i].RSI == 0 {
			continue
		}

		centerRSI := data[i].RSI
		isExtreme := true

		for j := i - d.config.LookbackLeft; j < i && isExtreme; j++ {
			if data[j].RSI != 0 && cmp(data[j].RSI, centerRSI) {
				isExtreme = false
			}
		}

		for j := i + 1; j <= i+d.config.LookbackRight && isExtreme; j++ {
			if data[j].RSI != 0 && cmp(data[j].RSI, centerRSI) {
				isExtreme = false
			}
		}

		if isExtreme {
			pivots = append(pivots, pivot{
				index: data[i].Index,
				price: data[i].Close,
				rsi:   data[i].RSI,
				date:  data[i].Date,
			})
		}
	}

	return pivots
}

// findPivotHighs detects RSI pivot highs (peaks).
func (d *Detector) findPivotHighs(data []market.PriceDataWithRSI) []pivot {
	return d.findPivots(data, func(neighbor, center float64) bool { return neighbor >= center })
}

// findPivotLows detects RSI pivot lows (troughs).
func (d *Detector) findPivotLows(data []market.PriceDataWithRSI) []pivot {
	return d.findPivots(data, func(neighbor, center float64) bool { return neighbor <= center })
}
