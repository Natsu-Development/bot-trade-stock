// Package service provides domain services for technical analysis.
package service

import (
	analysisvo "bot-trade/domain/analysis/valueobject"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// FindHighPivots finds high pivot points in market data.
// A high pivot is a point that is higher than all surrounding points within the pivot period.
//
// Parameters:
//   - data: Market data array with Index properly initialized
//   - field: Which field to analyze (High/Low/Close/RSI)
//   - pivotPeriod: Number of bars on each side to check for pivot confirmation
//
// Returns: Slice of high pivot MarketData found in the data.
func FindHighPivots(
	data []marketvo.MarketData,
	field analysisvo.PivotField,
	pivotPeriod int,
) []marketvo.MarketData {
	var pivots []marketvo.MarketData

	minRequired := pivotPeriod*2 + 1
	if len(data) < minRequired {
		return pivots
	}

	start := pivotPeriod
	end := len(data) - pivotPeriod

	for i := start; i < end; i++ {
		center := field.ValueFrom(data[i])
		if center == 0 {
			continue
		}

		if isHighPivot(data, i, center, field, pivotPeriod) {
			pivots = append(pivots, data[i])
		}
	}

	return pivots
}

// FindLowPivots finds low pivot points in market data.
// A low pivot is a point that is lower than all surrounding points within the pivot period.
//
// Parameters:
//   - data: Market data array with Index properly initialized
//   - field: Which field to analyze (High/Low/Close/RSI)
//   - pivotPeriod: Number of bars on each side to check for pivot confirmation
//
// Returns: Slice of low pivot MarketData found in the data.
func FindLowPivots(
	data []marketvo.MarketData,
	field analysisvo.PivotField,
	pivotPeriod int,
) []marketvo.MarketData {
	var pivots []marketvo.MarketData

	minRequired := pivotPeriod*2 + 1
	if len(data) < minRequired {
		return pivots
	}

	start := pivotPeriod
	end := len(data) - pivotPeriod

	for i := start; i < end; i++ {
		center := field.ValueFrom(data[i])
		if center == 0 {
			continue
		}

		if isLowPivot(data, i, center, field, pivotPeriod) {
			pivots = append(pivots, data[i])
		}
	}

	return pivots
}

// isHighPivot checks if index i is a high pivot point.
// A high pivot requires all neighbors to be strictly less than the center value.
func isHighPivot(
	data []marketvo.MarketData,
	i int,
	center float64,
	field analysisvo.PivotField,
	pivotPeriod int,
) bool {
	// Check left side: all neighbors must be less than center
	for j := i - pivotPeriod; j < i; j++ {
		neighbor := field.ValueFrom(data[j])
		if neighbor != 0 && neighbor >= center {
			return false
		}
	}

	// Check right side: all neighbors must be less than center
	for j := i + 1; j <= i+pivotPeriod; j++ {
		neighbor := field.ValueFrom(data[j])
		if neighbor != 0 && neighbor >= center {
			return false
		}
	}

	return true
}

// isLowPivot checks if index i is a low pivot point.
// A low pivot requires all neighbors to be strictly greater than the center value.
func isLowPivot(
	data []marketvo.MarketData,
	i int,
	center float64,
	field analysisvo.PivotField,
	pivotPeriod int,
) bool {
	// Check left side: all neighbors must be greater than center
	for j := i - pivotPeriod; j < i; j++ {
		neighbor := field.ValueFrom(data[j])
		if neighbor != 0 && neighbor <= center {
			return false
		}
	}

	// Check right side: all neighbors must be greater than center
	for j := i + 1; j <= i+pivotPeriod; j++ {
		neighbor := field.ValueFrom(data[j])
		if neighbor != 0 && neighbor <= center {
			return false
		}
	}

	return true
}