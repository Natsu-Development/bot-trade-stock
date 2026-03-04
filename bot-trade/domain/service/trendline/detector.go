package trendline

import (
	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/service/pivot"
	"fmt"
)

const (
	trendlineTolerance = 0.001 // ±0.1% band for "on the line"
)

// Detector detects trendline-based trading signals.
// Simplified version without Pine Script emulation complexity.
type Detector struct {
	pivotLength int
	maxLines    int
}

// NewDetector creates a new trendline detector.
func NewDetector(config TrendlineConfig) *Detector {
	pivotLength := config.PivotLength
	if pivotLength <= 0 {
		pivotLength = defaultPivotLength
	}
	maxLines := config.MaxLineLength
	if maxLines <= 0 {
		maxLines = 3 // Keep only recent 3 lines
	}
	return &Detector{
		pivotLength: pivotLength,
		maxLines:    maxLines,
	}
}

// DetectSignals analyzes price data and returns trading signals.
func (d *Detector) DetectSignals(data []market.MarketData) ([]BullishSignal, error) {
	if len(data) < d.pivotLength*2+1 {
		return nil, nil
	}

	var signals []BullishSignal

	// Find pivots directly using shared pivot finder
	finder := pivot.NewFinder(d.pivotLength)
	pivotHighs := finder.FindHighs(data, pivot.FieldHigh)
	pivotLows := finder.FindLows(data, pivot.FieldLow)

	// Create trendlines from consecutive pivots
	supportLines := d.createSupportLines(pivotLows)
	resistanceLines := d.createResistanceLines(pivotHighs)

	// Get current price and date
	currentIndex := len(data) - 1
	currentPrice := data[currentIndex].Close
	currentDate := data[currentIndex].Date

	// Detect signals from support lines
	for _, line := range supportLines {
		if signal := d.checkSupportSignal(line, currentIndex, currentPrice, currentDate); signal != nil {
			signals = append(signals, *signal)
		}
	}

	// Detect signals from resistance lines
	for _, line := range resistanceLines {
		if signal := d.checkResistanceSignal(line, currentIndex, currentPrice, currentDate); signal != nil {
			signals = append(signals, *signal)
		}
	}

	return signals, nil
}

// GetActiveTrendlines returns trendlines for display.
func (d *Detector) GetActiveTrendlines(data []market.MarketData) (support, resistance []Trendline) {
	finder := pivot.NewFinder(d.pivotLength)
	pivotHighs := finder.FindHighs(data, pivot.FieldHigh)
	pivotLows := finder.FindLows(data, pivot.FieldLow)

	support = d.createSupportLines(pivotLows)
	resistance = d.createResistanceLines(pivotHighs)

	return support, resistance
}

// createSupportLines creates uptrend support lines from consecutive ascending lows.
func (d *Detector) createSupportLines(lows []PricePivot) []Trendline {
	var lines []Trendline
	for i := 1; i < len(lows); i++ {
		if lows[i-1].Low < lows[i].Low { // Ascending
			line := Trendline{
				StartPivot: lows[i-1],
				EndPivot:   lows[i],
				Type:       UptrendSupport,
				IsValid:    true,
			}
			d.calculateLineMetrics(&line, lows[i-1].Low, lows[i].Low)
			lines = append(lines, line)
		}
	}
	return d.truncateLines(lines)
}

// createResistanceLines creates downtrend resistance lines from consecutive descending highs.
func (d *Detector) createResistanceLines(highs []PricePivot) []Trendline {
	var lines []Trendline
	for i := 1; i < len(highs); i++ {
		if highs[i-1].High > highs[i].High { // Descending
			line := Trendline{
				StartPivot: highs[i-1],
				EndPivot:   highs[i],
				Type:       DowntrendResistance,
				IsValid:    true,
			}
			d.calculateLineMetrics(&line, highs[i-1].High, highs[i].High)
			lines = append(lines, line)
		}
	}
	return d.truncateLines(lines)
}

// truncateLines keeps only the most recent lines.
func (d *Detector) truncateLines(lines []Trendline) []Trendline {
	if len(lines) <= d.maxLines {
		return lines
	}
	return lines[len(lines)-d.maxLines:]
}

// calculateLineMetrics calculates and sets the slope and intercept for a trendline.
// Uses linear equation: y = mx + b, where m is slope and b is intercept.
func (d *Detector) calculateLineMetrics(line *Trendline, startPrice, endPrice float64) {
	startIndex := line.StartPivot.Index
	endIndex := line.EndPivot.Index

	// Calculate slope: (y2 - y1) / (x2 - x1)
	if endIndex != startIndex {
		line.Slope = (endPrice - startPrice) / float64(endIndex-startIndex)
	} else {
		line.Slope = 0
	}

	// Calculate intercept: b = y - mx
	// Using start point: intercept = startPrice - slope * startIndex
	line.Intercept = startPrice - line.Slope*float64(startIndex)
}

// getLinePrice calculates the trendline price at a given index using linear scale.
func (d *Detector) getLinePrice(line Trendline, index int) float64 {
	// Simple linear interpolation: price = startPrice + slope * (index - startIndex)
	var startPrice, endPrice float64
	if line.Type == UptrendSupport {
		startPrice = line.StartPivot.Low
		endPrice = line.EndPivot.Low
	} else {
		startPrice = line.StartPivot.High
		endPrice = line.EndPivot.High
	}

	slope := (endPrice - startPrice) / float64(line.EndPivot.Index-line.StartPivot.Index)
	return startPrice + slope*float64(index-line.StartPivot.Index)
}

// checkSupportSignal detects signals from an uptrend support line.
func (d *Detector) checkSupportSignal(line Trendline, currentIndex int, currentPrice float64, currentDate string) *BullishSignal {
	linePrice := d.getLinePrice(line, currentIndex)

	if currentPrice > linePrice*(1+trendlineTolerance) {
		return &BullishSignal{
			Type:      market.BounceConfirmed,
			Trendline: line,
			Price:     currentPrice,
			Time:      currentDate,
			Message:   fmt.Sprintf("Bounced off uptrend support at %.2f. Price: %.2f", linePrice, currentPrice),
		}
	}

	if currentPrice >= linePrice*(1-trendlineTolerance) {
		return &BullishSignal{
			Type:      market.BouncePotential,
			Trendline: line,
			Price:     currentPrice,
			Time:      currentDate,
			Message:   fmt.Sprintf("At uptrend support %.2f. Price: %.2f", linePrice, currentPrice),
		}
	}

	return nil
}

// checkResistanceSignal detects signals from a downtrend resistance line.
func (d *Detector) checkResistanceSignal(line Trendline, currentIndex int, currentPrice float64, currentDate string) *BullishSignal {
	linePrice := d.getLinePrice(line, currentIndex)

	if currentPrice > linePrice*(1+trendlineTolerance) {
		return &BullishSignal{
			Type:      market.BreakoutConfirmed,
			Trendline: line,
			Price:     currentPrice,
			Time:      currentDate,
			Message:   fmt.Sprintf("Breakout above downtrend resistance at %.2f. Price: %.2f", linePrice, currentPrice),
		}
	}

	if currentPrice <= linePrice*(1+trendlineTolerance) {
		return &BullishSignal{
			Type:      market.BreakoutPotential,
			Trendline: line,
			Price:     currentPrice,
			Time:      currentDate,
			Message:   fmt.Sprintf("At downtrend resistance %.2f. Price: %.2f", linePrice, currentPrice),
		}
	}

	return nil
}
