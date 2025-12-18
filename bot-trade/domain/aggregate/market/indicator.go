package market

import "math"

// PriceDataWithRSI is PriceData enriched with RSI value.
type PriceDataWithRSI struct {
	Index int
	Date  string
	Close float64
	RSI   float64
}

// CalculateRSI computes RSI for price history using Wilder's smoothing method.
// Returns enriched data with RSI values starting from index=period.
func CalculateRSI(prices []*PriceData, period int) []PriceDataWithRSI {
	if len(prices) < period+1 {
		return nil
	}

	// Extract close prices and calculate gains/losses
	gains := make([]float64, len(prices)-1)
	losses := make([]float64, len(prices)-1)
	for i := 1; i < len(prices); i++ {
		change := prices[i].Close - prices[i-1].Close
		if change > 0 {
			gains[i-1] = change
		} else if change < 0 {
			losses[i-1] = math.Abs(change)
		}
	}

	// Initial averages for first RSI
	var avgGain, avgLoss float64
	for i := 0; i < period; i++ {
		avgGain += gains[i]
		avgLoss += losses[i]
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	// Build result with RSI values
	result := make([]PriceDataWithRSI, len(prices))
	result[period] = PriceDataWithRSI{
		Index: period,
		Date:  prices[period].Date,
		Close: prices[period].Close,
		RSI:   rsiValue(avgGain, avgLoss),
	}

	// Subsequent RSI values using Wilder's smoothing
	for i := period + 1; i < len(prices); i++ {
		avgGain = (avgGain*float64(period-1) + gains[i-1]) / float64(period)
		avgLoss = (avgLoss*float64(period-1) + losses[i-1]) / float64(period)
		result[i] = PriceDataWithRSI{
			Index: i,
			Date:  prices[i].Date,
			Close: prices[i].Close,
			RSI:   rsiValue(avgGain, avgLoss),
		}
	}

	return result
}

func rsiValue(avgGain, avgLoss float64) float64 {
	if avgLoss == 0 {
		return 100.0
	}
	return 100.0 - (100.0 / (1.0 + avgGain/avgLoss))
}

