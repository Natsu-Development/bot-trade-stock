// Package indicator provides technical indicator calculations as domain services.
package indicator

import (
	"math"

	"bot-trade/domain/aggregate/market"
)

// CalculateRSI computes RSI for price history using Wilder's smoothing method.
// Returns enriched MarketData with RSI values starting from index=period.
func CalculateRSI(prices []*market.PriceData, period int) []market.MarketData {
	if len(prices) < period+1 {
		return nil
	}

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

	var avgGain, avgLoss float64
	for i := 0; i < period; i++ {
		avgGain += gains[i]
		avgLoss += losses[i]
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	result := make([]market.MarketData, len(prices))
	result[period] = market.MarketData{
		Index:  period,
		Date:   prices[period].Date,
		Open:   prices[period].Open,
		High:   prices[period].High,
		Low:    prices[period].Low,
		Close:  prices[period].Close,
		Volume: prices[period].Volume,
		RSI:    rsiValue(avgGain, avgLoss),
	}

	for i := period + 1; i < len(prices); i++ {
		avgGain = (avgGain*float64(period-1) + gains[i-1]) / float64(period)
		avgLoss = (avgLoss*float64(period-1) + losses[i-1]) / float64(period)
		result[i] = market.MarketData{
			Index:  i,
			Date:   prices[i].Date,
			Open:   prices[i].Open,
			High:   prices[i].High,
			Low:    prices[i].Low,
			Close:  prices[i].Close,
			Volume: prices[i].Volume,
			RSI:    rsiValue(avgGain, avgLoss),
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
