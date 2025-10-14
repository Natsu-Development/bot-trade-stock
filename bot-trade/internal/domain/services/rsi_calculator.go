package services

import (
	"math"

	"bot-trade/internal/domain/entities"
	"bot-trade/internal/domain/valueobjects"
)

// RSICalculatorService handles RSI calculations using Wilder's method
type RSICalculatorService struct {
	period int
}

// NewRSICalculatorService creates a new RSI calculator service
func NewRSICalculatorService(period int) *RSICalculatorService {
	return &RSICalculatorService{
		period: period,
	}
}

// CalculateRSI calculates RSI values using Wilder's smoothing method
// This implementation follows the exact Wilder's RSI formula used by major trading platforms:
// 1. First N periods: Simple Moving Average (SMA) of gains and losses
// 2. Subsequent periods: Wilder's smoothing (EMA with alpha = 1/N)
// 3. RSI = 100 - (100 / (1 + RS))
// 4. RS = Average Gain / Average Loss
func (rs *RSICalculatorService) CalculateRSI(priceHistory []*entities.PriceData) ([]float64, error) {
	if len(priceHistory) < rs.period+1 {
		return []float64{}, nil
	}

	// Extract prices
	prices := make([]float64, len(priceHistory))
	for i, price := range priceHistory {
		prices[i] = price.Close().Value()
	}

	rsi := make([]float64, len(prices))

	// Calculate daily changes
	gains := make([]float64, 0)
	losses := make([]float64, 0)

	for i := 1; i < len(prices); i++ {
		change := prices[i] - prices[i-1]
		if change > 0 {
			gains = append(gains, change)
			losses = append(losses, 0.0)
		} else if change < 0 {
			gains = append(gains, 0.0)
			losses = append(losses, math.Abs(change))
		} else {
			gains = append(gains, 0.0)
			losses = append(losses, 0.0)
		}
	}

	// Step 1: Calculate INITIAL averages using SMA for FIRST N periods
	var avgGain, avgLoss float64
	for i := 0; i < rs.period && i < len(gains); i++ {
		avgGain += gains[i]
		avgLoss += losses[i]
	}
	avgGain = avgGain / float64(rs.period)
	avgLoss = avgLoss / float64(rs.period)

	// Calculate FIRST RSI (at position N)
	var firstRSI float64
	if avgLoss == 0 {
		firstRSI = 100.0
	} else {
		rs := avgGain / avgLoss
		firstRSI = 100.0 - (100.0 / (1.0 + rs))
	}
	rsi[rs.period] = firstRSI

	// Step 2: Use WILDER'S SMOOTHING for remaining periods
	// Formula: New_Average = (Old_Average * (N-1) + New_Value) / N
	for i := rs.period + 1; i < len(prices) && i-1 < len(gains); i++ {
		// Apply Wilder's smoothing
		avgGain = (avgGain*float64(rs.period-1) + gains[i-1]) / float64(rs.period)
		avgLoss = (avgLoss*float64(rs.period-1) + losses[i-1]) / float64(rs.period)

		// Calculate RSI
		if avgLoss == 0 {
			rsi[i] = 100.0
		} else {
			rs := avgGain / avgLoss
			rsi[i] = 100.0 - (100.0 / (1.0 + rs))
		}
	}

	return rsi, nil
}

// GetValidRSIValues extracts valid RSI values (> 0 and not duplicates)
func (rs *RSICalculatorService) GetValidRSIValues(rsiValues []float64) ([]*valueobjects.RSIValue, error) {
	validRSI := make([]*valueobjects.RSIValue, 0)

	if len(rsiValues) == 0 {
		return validRSI, nil
	}

	prevRSI := -1.0
	for i := rs.period; i < len(rsiValues); i++ {
		currentRSIValue := rsiValues[i]

		// Only include valid, non-duplicate RSI values
		if currentRSIValue > 0 && !math.IsNaN(currentRSIValue) && !math.IsInf(currentRSIValue, 0) {
			// Avoid adding exact duplicates (which suggests calculation error)
			if math.Abs(currentRSIValue-prevRSI) > 0.0001 || len(validRSI) == 0 {
				rsiValue, err := valueobjects.NewRSIValue(currentRSIValue)
				if err != nil {
					continue // Skip invalid RSI values
				}
				validRSI = append(validRSI, rsiValue)
				prevRSI = currentRSIValue
			}
		}
	}

	return validRSI, nil
}
