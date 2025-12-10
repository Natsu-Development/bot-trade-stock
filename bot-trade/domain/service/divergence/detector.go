// Package divergence provides RSI divergence detection for trading signals.
package divergence

import (
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
)

// Detector is a domain service that detects RSI divergences.
// It encapsulates all divergence detection logic: RSI calculation,
// pivot detection, and divergence analysis.
type Detector struct {
	rsiPeriod int
	config    analysis.DivergenceConfig
}

// NewDetector creates a new divergence detector.
func NewDetector(rsiPeriod int, config analysis.DivergenceConfig) *Detector {
	return &Detector{
		rsiPeriod: rsiPeriod,
		config:    config,
	}
}

// DetectBullish detects bullish divergence (Price Lower Low + RSI Higher Low).
func (d *Detector) DetectBullish(priceHistory []*market.PriceData) *analysis.DivergenceResult {
	rsiValues := d.calculateRSI(priceHistory)
	if len(rsiValues) == 0 {
		return analysis.NewNoDivergenceResult(0, 0)
	}

	nodes := d.createNodes(priceHistory, rsiValues)
	pivotLows := d.findPivotLows(nodes)

	return d.analyzeDivergence(nodes, pivotLows, analysis.BullishDivergence)
}

// DetectBearish detects bearish divergence (Price Higher High + RSI Lower High).
func (d *Detector) DetectBearish(priceHistory []*market.PriceData) *analysis.DivergenceResult {
	rsiValues := d.calculateRSI(priceHistory)
	if len(rsiValues) == 0 {
		return analysis.NewNoDivergenceResult(0, 0)
	}

	nodes := d.createNodes(priceHistory, rsiValues)
	pivotHighs := d.findPivotHighs(nodes)

	return d.analyzeDivergence(nodes, pivotHighs, analysis.BearishDivergence)
}
