// Package indicator provides technical indicator calculations as domain services.
package indicator

import (
	"math"

	"bot-trade/domain/aggregate/market"
)

// CalculateRSI computes RSI for price history using Wilder's smoothing method.
// Takes []MarketData with Index already initialized and returns a new slice
// with RSI values calculated. RSI is 0 for indices before the period.
func CalculateRSI(data []market.MarketData, period int) []market.MarketData {
	if len(data) < period+1 {
		return nil
	}

	// Calculate gains/losses from data.Close
	gains := make([]float64, len(data)-1)
	losses := make([]float64, len(data)-1)
	for i := 1; i < len(data); i++ {
		change := data[i].Close - data[i-1].Close
		if change > 0 {
			gains[i-1] = change
		} else if change < 0 {
			losses[i-1] = math.Abs(change)
		}
	}

	// Calculate initial averages
	var avgGain, avgLoss float64
	for i := 0; i < period; i++ {
		avgGain += gains[i]
		avgLoss += losses[i]
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	// Create result slice with RSI values
	result := make([]market.MarketData, len(data))

	// Copy data before period (RSI stays 0, Index is already set)
	for i := 0; i < period; i++ {
		result[i] = data[i]
		result[i].RSI = 0
	}

	// Add RSI from period onwards (Index is already set)
	result[period] = data[period]
	result[period].RSI = rsiValue(avgGain, avgLoss)

	for i := period + 1; i < len(data); i++ {
		avgGain = (avgGain*float64(period-1) + gains[i-1]) / float64(period)
		avgLoss = (avgLoss*float64(period-1) + losses[i-1]) / float64(period)
		result[i] = data[i]
		result[i].RSI = rsiValue(avgGain, avgLoss)
	}

	return result
}

func rsiValue(avgGain, avgLoss float64) float64 {
	if avgLoss == 0 {
		return 100.0
	}
	return 100.0 - (100.0 / (1.0 + avgGain/avgLoss))
}
