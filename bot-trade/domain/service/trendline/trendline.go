package trendline

import (
	"math"
)

// calculateTrendlinePineStyle calculates slope and intercept using Pine Script logic.
// Supports both linear and log scale.
func (d *Detector) calculateTrendlinePineStyle(start, end PricePivot, lineType LineType) Trendline {
	if start.Index == end.Index {
		return Trendline{IsValid: false}
	}

	var startPrice, endPrice float64

	// For support lines, use lows
	// For resistance lines, use highs
	if lineType == UptrendSupport {
		startPrice = start.Low
		endPrice = end.Low
	} else {
		startPrice = start.High
		endPrice = end.High
	}

	var slope, intercept, interceptLog float64

	if d.config.UseLogScale {
		// Pine Script log scale slope calculation:
		// slopePh = (log(line.get_y2(line)) - log(line.get_y1(line))) / (line.get_x2(line) - line.get_x1(line))
		slope = (math.Log(endPrice) - math.Log(startPrice)) / float64(end.Index-start.Index)
		// For log scale: interceptLog = log(endPrice)
		interceptLog = math.Log(endPrice)
		// Linear intercept for backward compatibility
		intercept = startPrice - float64(start.Index)*slope
	} else {
		// Pine Script linear slope calculation:
		// slopePh = (line.get_y2(line) - line.get_y1(line)) / (line.get_x2(line) - line.get_x1(line))
		slope = (endPrice - startPrice) / float64(end.Index-start.Index)
		intercept = startPrice - float64(start.Index)*slope
		interceptLog = math.Log(endPrice)
	}

	// Copy pivots to avoid modifying originals
	startCopy := start
	endCopy := end

	return Trendline{
		StartPivot:   startCopy,
		EndPivot:     endCopy,
		Slope:        slope,
		Intercept:    intercept,
		InterceptLog: interceptLog,
		Type:         lineType,
		IsValid:      true,
		IsExtended:   true, // Pine Script always extends lines
		UseLogScale:  d.config.UseLogScale,
	}
}

// extendTrendlinesToCurrentBar extends all trendlines to the current bar index.
// This matches Pine Script behavior where lines are extended dynamically.
//
// Pine Script:
// for l in utlArray
//
//	extended = not isLog ? getSlope(l) : getSlopeLog(l)
//	l.set_xy2(bar_index, extended)
func (d *Detector) extendTrendlinesToCurrentBar(lines []Trendline, currentIndex int) {
	for i := range lines {
		if d.config.UseLogScale {
			// Log scale extension: price = exp(interceptLog - slope * (endIndex - currentIndex))
			lines[i].Intercept = lines[i].PriceAtLog(currentIndex)
		}
		// For linear, PriceAt() already handles extension
	}
}

// getSlope calculates the extended price for a linear trendline at current bar.
// Pine Script: getSlope(line) => extendedPh = line.get_y2(line) - slopePh * (line.get_x2(line) - bar_index)
func (d *Detector) getSlope(line Trendline, currentIndex int) float64 {
	// extended = y2 - slope * (x2 - currentIndex)
	// This is equivalent to: price = intercept + slope * currentIndex
	return line.PriceAt(currentIndex)
}

// getSlopeLog calculates the extended price for a log scale trendline at current bar.
// Pine Script: getSlopeLog(line) => extendedPh = exp(log(line.get_y2(line)) - slopePh * (line.get_x2(line) - bar_index))
func (d *Detector) getSlopeLog(line Trendline, currentIndex int) float64 {
	// extended = exp(log(y2) - slope * (x2 - currentIndex))
	return line.PriceAtLog(currentIndex)
}

// removeOldLines removes lines that have exceeded the maximum line length.
//
// Pine Script:
// if l.get_x2() - l.get_x1() > maxLineLen
//
//	l.delete()
func (d *Detector) removeOldLines(lines []Trendline, currentIndex int) []Trendline {
	var result []Trendline

	for _, line := range lines {
		lineLength := currentIndex - line.StartPivot.Index
		if lineLength <= d.config.MaxLineLength {
			result = append(result, line)
		}
	}

	return result
}

// distanceToTrendline calculates the percentage distance from price to trendline.
// For UptrendSupport: positive means price below support (opportunity zone)
// For DowntrendResistance: positive means price above resistance (breakout zone)
func (d *Detector) distanceToTrendline(price float64, trendlinePrice float64, lineType LineType) float64 {
	if trendlinePrice == 0 {
		return 0
	}

	if lineType == UptrendSupport {
		// For support: how far below the line is price?
		// Positive = price is below support (potential bounce area)
		return (trendlinePrice - price) / trendlinePrice * 100
	}

	// For resistance: how far above the line is price?
	// Positive = price broke above resistance (breakout)
	return (price - trendlinePrice) / trendlinePrice * 100
}

// isNearTrendline checks if price is within threshold percentage of trendline.
func (d *Detector) isNearTrendline(price, trendlinePrice, threshold float64) bool {
	distance := math.Abs(price-trendlinePrice) / trendlinePrice * 100
	return distance <= threshold
}
