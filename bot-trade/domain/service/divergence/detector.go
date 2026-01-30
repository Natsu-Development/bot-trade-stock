// Package divergence provides RSI divergence detection for trading signals.
package divergence

import (
	"errors"
	"fmt"
	"sort"

	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
)

// Config holds configuration for divergence detection.
type Config struct {
	LookbackLeft  int
	LookbackRight int
	RangeMin      int
	RangeMax      int
}

// NewConfig creates a validated Config.
func NewConfig(lookbackLeft, lookbackRight, rangeMin, rangeMax int) (Config, error) {
	if lookbackLeft <= 0 {
		return Config{}, errors.New("lookbackLeft must be positive")
	}
	if lookbackRight <= 0 {
		return Config{}, errors.New("lookbackRight must be positive")
	}
	if rangeMin <= 0 {
		return Config{}, errors.New("rangeMin must be positive")
	}
	if rangeMax <= 0 {
		return Config{}, errors.New("rangeMax must be positive")
	}
	if rangeMin > rangeMax {
		return Config{}, fmt.Errorf("rangeMin (%d) cannot be greater than rangeMax (%d)", rangeMin, rangeMax)
	}

	return Config{
		LookbackLeft:  lookbackLeft,
		LookbackRight: lookbackRight,
		RangeMin:      rangeMin,
		RangeMax:      rangeMax,
	}, nil
}

// DetectionResult holds the result of divergence detection.
type DetectionResult struct {
	Found       bool
	Type        analysis.DivergenceType
	Description string
	// Early detection fields
	EarlySignal      bool
	EarlyDescription string
}

// Detector is a domain service that detects RSI divergences.
type Detector struct {
	config Config
}

// NewDetector creates a new divergence detector.
func NewDetector(config Config) *Detector {
	return &Detector{config: config}
}

// DetectBullish detects bullish divergence (Price Lower Low + RSI Higher Low).
func (d *Detector) DetectBullish(data []market.PriceDataWithRSI) DetectionResult {
	if len(data) == 0 {
		return DetectionResult{Found: false, Type: analysis.NoDivergence}
	}
	pivots := d.findPivotLows(data)
	return d.analyze(pivots, analysis.BullishDivergence)
}

// DetectBearish detects bearish divergence (Price Higher High + RSI Lower High).
func (d *Detector) DetectBearish(data []market.PriceDataWithRSI) DetectionResult {
	if len(data) == 0 {
		return DetectionResult{Found: false, Type: analysis.NoDivergence}
	}
	pivots := d.findPivotHighs(data)
	return d.analyze(pivots, analysis.BearishDivergence)
}

// DetectEarlyBearish detects forming bearish divergence using the current price.
// It compares the current bar with the most recent confirmed RSI high pivot.
// Returns early signal if: current price > pivot price AND current RSI < pivot RSI.
func (d *Detector) DetectEarlyBearish(data []market.PriceDataWithRSI) DetectionResult {
	if len(data) == 0 {
		return DetectionResult{}
	}

	// Find confirmed pivot highs (requires LookbackLeft + LookbackRight for confirmation)
	pivots := d.findPivotHighs(data)
	if len(pivots) == 0 {
		return DetectionResult{}
	}

	// Sort pivots by index descending (most recent first)
	sort.Slice(pivots, func(i, j int) bool {
		return pivots[i].index > pivots[j].index
	})

	// Get current bar (last data point with valid RSI)
	var current market.PriceDataWithRSI
	for i := len(data) - 1; i >= 0; i-- {
		if data[i].RSI != 0 {
			current = data[i]
			break
		}
	}

	if current.RSI == 0 {
		return DetectionResult{}
	}

	// Get most recent confirmed pivot
	lastPivot := pivots[0]

	// Check forming bearish divergence:
	// - Price makes Higher High (current > pivot)
	// - RSI makes Lower High (current RSI < pivot RSI)
	if current.Close > lastPivot.price && current.RSI < lastPivot.rsi {
		return DetectionResult{
			EarlySignal: true,
			Type:        analysis.BearishDivergence,
			EarlyDescription: fmt.Sprintf(
				"Forming Bearish: Price %.2f > %.2f, RSI %.2f < %.2f, Date %s",
				current.Close, lastPivot.price, current.RSI, lastPivot.rsi, current.Date,
			),
		}
	}

	return DetectionResult{}
}
