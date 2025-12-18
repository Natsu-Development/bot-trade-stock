package divergence

import (
	"math"

	"bot-trade/domain/aggregate/market"
)

// calculateRSI computes RSI values using Wilder's smoothing method.
func (d *Detector) calculateRSI(priceHistory []*market.PriceData) []float64 {
	if len(priceHistory) < d.rsiPeriod+1 {
		return nil
	}

	prices := extractClosePrices(priceHistory)
	gains, losses := calculateGainsAndLosses(prices)

	return computeRSI(prices, gains, losses, d.rsiPeriod)
}

func extractClosePrices(priceHistory []*market.PriceData) []float64 {
	prices := make([]float64, len(priceHistory))
	for i, p := range priceHistory {
		prices[i] = p.Close
	}
	return prices
}

func calculateGainsAndLosses(prices []float64) ([]float64, []float64) {
	gains := make([]float64, 0, len(prices)-1)
	losses := make([]float64, 0, len(prices)-1)

	for i := 1; i < len(prices); i++ {
		change := prices[i] - prices[i-1]
		if change > 0 {
			gains = append(gains, change)
			losses = append(losses, 0)
		} else if change < 0 {
			gains = append(gains, 0)
			losses = append(losses, math.Abs(change))
		} else {
			gains = append(gains, 0)
			losses = append(losses, 0)
		}
	}

	return gains, losses
}

func computeRSI(prices, gains, losses []float64, period int) []float64 {
	rsi := make([]float64, len(prices))

	avgGain, avgLoss := initialAverages(gains, losses, period)
	rsi[period] = calculateRSIValue(avgGain, avgLoss)

	for i := period + 1; i < len(prices) && i-1 < len(gains); i++ {
		avgGain = wilderSmooth(avgGain, gains[i-1], period)
		avgLoss = wilderSmooth(avgLoss, losses[i-1], period)
		rsi[i] = calculateRSIValue(avgGain, avgLoss)
	}

	return rsi
}

func initialAverages(gains, losses []float64, period int) (float64, float64) {
	var avgGain, avgLoss float64
	for i := 0; i < period && i < len(gains); i++ {
		avgGain += gains[i]
		avgLoss += losses[i]
	}
	return avgGain / float64(period), avgLoss / float64(period)
}

func wilderSmooth(prevAvg, currentValue float64, period int) float64 {
	return (prevAvg*float64(period-1) + currentValue) / float64(period)
}

func calculateRSIValue(avgGain, avgLoss float64) float64 {
	if avgLoss == 0 {
		return 100.0
	}
	return 100.0 - (100.0 / (1.0 + avgGain/avgLoss))
}
