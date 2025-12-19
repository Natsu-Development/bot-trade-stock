package divergence

import "bot-trade/domain/aggregate/market"

// pivot represents a detected pivot point in RSI data.
type pivot struct {
	index int
	price float64
	rsi   float64
	date  string
}

// findPivotHighs detects RSI pivot highs (peaks).
func (d *Detector) findPivotHighs(data []market.PriceDataWithRSI) []pivot {
	minRequired := d.config.LookbackLeft + d.config.LookbackRight + 1
	if len(data) < minRequired {
		return nil
	}

	var pivots []pivot
	for i := d.config.LookbackLeft; i < len(data)-d.config.LookbackRight; i++ {
		if data[i].RSI == 0 {
			continue
		}

		isHigh := true
		centerRSI := data[i].RSI

		// Check left: center must be higher than all left values
		for j := i - d.config.LookbackLeft; j < i && isHigh; j++ {
			if data[j].RSI != 0 && data[j].RSI >= centerRSI {
				isHigh = false
			}
		}

		// Check right: center must be higher than all right values
		for j := i + 1; j <= i+d.config.LookbackRight && isHigh; j++ {
			if data[j].RSI != 0 && data[j].RSI >= centerRSI {
				isHigh = false
			}
		}

		if isHigh {
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

// findPivotLows detects RSI pivot lows (troughs).
func (d *Detector) findPivotLows(data []market.PriceDataWithRSI) []pivot {
	minRequired := d.config.LookbackLeft + d.config.LookbackRight + 1
	if len(data) < minRequired {
		return nil
	}

	var pivots []pivot
	for i := d.config.LookbackLeft; i < len(data)-d.config.LookbackRight; i++ {
		if data[i].RSI == 0 {
			continue
		}

		isLow := true
		centerRSI := data[i].RSI

		// Check left: center must be lower than all left values
		for j := i - d.config.LookbackLeft; j < i && isLow; j++ {
			if data[j].RSI != 0 && data[j].RSI <= centerRSI {
				isLow = false
			}
		}

		// Check right: center must be lower than all right values
		for j := i + 1; j <= i+d.config.LookbackRight && isLow; j++ {
			if data[j].RSI != 0 && data[j].RSI <= centerRSI {
				isLow = false
			}
		}

		if isLow {
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

