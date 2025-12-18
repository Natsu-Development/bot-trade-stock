// Package divergence provides RSI divergence detection for trading signals.
package divergence

import (
	"errors"
	"fmt"

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

