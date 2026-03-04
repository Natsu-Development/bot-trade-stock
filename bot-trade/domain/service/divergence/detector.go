// Package divergence provides RSI divergence detection for trading signals.
package divergence

import (
	"errors"
	"fmt"
	"sort"

	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/service/pivot"
)

// Config holds configuration for divergence detection.
type Config struct {
	Lookback int
	RangeMin int
	RangeMax int
}

// NewConfig creates a validated Config.
func NewConfig(lookback, rangeMin, rangeMax int) (Config, error) {
	if lookback <= 0 {
		return Config{}, errors.New("lookback must be positive")
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
		Lookback: lookback,
		RangeMin: rangeMin,
		RangeMax: rangeMax,
	}, nil
}

// DetectionResult holds the result of divergence detection.
type DetectionResult struct {
	Found       bool
	Type        analysis.DivergenceType
	Description string
	// PivotPoints: The two pivots that form the divergence pattern
	// PivotPoints[0] = First pivot (older date, FROM)
	// PivotPoints[1] = Second pivot (newer date, TO)
	PivotPoints []DetectionPivotPoint
	// Early detection fields
	EarlySignal      bool
	EarlyDescription string
}

// DetectionPivotPoint is an alias for the shared PivotPoint type.
type DetectionPivotPoint = pivot.PivotPoint

// Detector is a domain service that detects RSI divergences.
type Detector struct {
	config Config
}

// NewDetector creates a new divergence detector.
func NewDetector(config Config) *Detector {
	return &Detector{config: config}
}

// DetectBullish detects bullish divergence (Price Lower Low + RSI Higher Low).
func (d *Detector) DetectBullish(data []market.MarketData) DetectionResult {
	if len(data) == 0 {
		return DetectionResult{Found: false, Type: analysis.NoDivergence}
	}
	finder := pivot.NewFinder(d.config.Lookback)
	pivots := finder.FindLows(data, pivot.FieldRSI)
	return d.analyze(pivots, analysis.BullishDivergence)
}

// DetectBearish detects bearish divergence (Price Higher High + RSI Lower High).
func (d *Detector) DetectBearish(data []market.MarketData) DetectionResult {
	if len(data) == 0 {
		return DetectionResult{Found: false, Type: analysis.NoDivergence}
	}
	finder := pivot.NewFinder(d.config.Lookback)
	pivots := finder.FindHighs(data, pivot.FieldRSI)
	return d.analyze(pivots, analysis.BearishDivergence)
}

// DetectEarlyBearish detects forming bearish divergence using the current price.
// It compares the current bar with the most recent confirmed RSI high pivot.
// Returns early signal if: current price > pivot price AND current RSI < pivot RSI.
func (d *Detector) DetectEarlyBearish(data []market.MarketData) DetectionResult {
	if len(data) == 0 {
		return DetectionResult{}
	}

	finder := pivot.NewFinder(d.config.Lookback)
	pivots := finder.FindHighs(data, pivot.FieldRSI)
	if len(pivots) == 0 {
		return DetectionResult{}
	}

	sort.Slice(pivots, func(i, j int) bool {
		return pivots[i].Index > pivots[j].Index
	})

	var current market.MarketData
	for i := len(data) - 1; i >= 0; i-- {
		if data[i].RSI != 0 {
			current = data[i]
			break
		}
	}

	if current.RSI == 0 {
		return DetectionResult{}
	}

	lastPivot := pivots[0]

	if current.Close > lastPivot.Price && current.RSI < lastPivot.RSI {
		return DetectionResult{
			EarlySignal: true,
			Type:        analysis.BearishDivergence,
			EarlyDescription: fmt.Sprintf(
				"Forming Bearish: Price %.2f > %.2f, RSI %.2f < %.2f, Date %s",
				current.Close, lastPivot.Low, current.RSI, lastPivot.RSI, current.Date,
			),
		}
	}

	return DetectionResult{}
}
