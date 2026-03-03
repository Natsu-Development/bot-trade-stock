package trendline

import (
	"fmt"

	"bot-trade/domain/aggregate/market"
)

// Detector detects trendline-based trading signals using Pine Script logic.
type Detector struct {
	config TrendlineConfig
}

// NewDetector creates a new trendline signal detector.
func NewDetector(config TrendlineConfig) *Detector {
	return &Detector{config: config}
}

// DetectSignals analyzes price data and returns all trendline signals.
// Uses Pine Script style sequential pivot detection and trendline creation.
// Detects historical cross events throughout the entire price history.
func (d *Detector) DetectSignals(prices []*market.PriceData) ([]BullishSignal, error) {
	if len(prices) == 0 {
		return nil, nil
	}

	var signals []BullishSignal

	// Find pivot highs and lows using Pine Script style (single pivotLength)
	pivotHighs := d.findPricePivotHighs(prices, d.config.PivotLength)
	pivotLows := d.findPricePivotLows(prices, d.config.PivotLength)

	if len(pivotHighs) < 2 && len(pivotLows) < 2 {
		return signals, nil
	}

	// Get current bar index
	currentIndex := len(prices) - 1

	// Create trendlines using Pine Script logic
	uptrendLines := d.createUptrendLinesPineStyle(pivotLows, currentIndex)
	downtrendLines := d.createDowntrendLinesPineStyle(pivotHighs, currentIndex)

	// Remove old lines that exceeded MaxLineLength
	uptrendLines = d.removeOldLines(uptrendLines, currentIndex)
	downtrendLines = d.removeOldLines(downtrendLines, currentIndex)

	// Detect historical crosses for all trendlines
	d.detectHistoricalCrosses(uptrendLines, prices, currentIndex)
	d.detectHistoricalCrosses(downtrendLines, prices, currentIndex)

	// Get current bar data
	currentPrice := prices[currentIndex].Close

	// Detect signals from support lines (bounce signals)
	for _, line := range uptrendLines {
		signal := d.detectSupportSignal(line, currentIndex, currentPrice, prices[currentIndex].Date)
		if signal != nil {
			signals = append(signals, *signal)
		}
	}

	// Detect signals from resistance lines (breakout signals)
	for _, line := range downtrendLines {
		signal := d.detectResistanceSignal(line, currentIndex, currentPrice, prices[currentIndex].Date)
		if signal != nil {
			signals = append(signals, *signal)
		}
	}

	// Add signals for historical crosses
	allLines := append(uptrendLines, downtrendLines...)
	for _, line := range allLines {
		for _, cross := range line.Crosses {
			signal := d.createCrossSignal(line, cross)
			if signal != nil {
				signals = append(signals, *signal)
			}
		}
	}

	return signals, nil
}

// getTrendlinePrice returns the trendline price at current index.
func (d *Detector) getTrendlinePrice(line Trendline, currentIndex int) float64 {
	if d.config.UseLogScale {
		return d.getSlopeLog(line, currentIndex)
	}
	return d.getSlope(line, currentIndex)
}

// detectSupportSignal detects signals from an uptrend support line.
// Simplified logic: price at support = potential, price above = bounce
func (d *Detector) detectSupportSignal(line Trendline, currentIndex int, currentPrice float64, date string) *BullishSignal {
	trendlinePrice := d.getTrendlinePrice(line, currentIndex)
	distance := d.distanceToTrendline(currentPrice, trendlinePrice, UptrendSupport)

	signal := &BullishSignal{
		Trendline:      line,
		Price:          currentPrice,
		TrendlinePrice: trendlinePrice,
		Distance:       distance,
		Time:           date,
	}

	// Use a small tolerance for floating point comparison
	const tolerance = 0.001

	switch {
	case currentPrice > trendlinePrice*(1+tolerance):
		// Price above support - bounce confirmed
		signal.Type = BounceConfirmed
		signal.Message = fmt.Sprintf(
			"Bounced off uptrend support at %.2f. Price: %.2f",
			trendlinePrice, currentPrice,
		)
		return signal

	case currentPrice >= trendlinePrice*(1-tolerance):
		// Price at or below support - potential bounce
		signal.Type = BouncePotential
		signal.Message = fmt.Sprintf(
			"At uptrend support %.2f. Price: %.2f",
			trendlinePrice, currentPrice,
		)
		return signal

	default:
		return nil
	}
}

// detectResistanceSignal detects signals from a downtrend resistance line.
// Simplified logic: price at or below resistance = potential, price above = breakout
func (d *Detector) detectResistanceSignal(line Trendline, currentIndex int, currentPrice float64, date string) *BullishSignal {
	trendlinePrice := d.getTrendlinePrice(line, currentIndex)
	distance := d.distanceToTrendline(currentPrice, trendlinePrice, DowntrendResistance)

	signal := &BullishSignal{
		Trendline:      line,
		Price:          currentPrice,
		TrendlinePrice: trendlinePrice,
		Distance:       distance,
		Time:           date,
	}

	// Use a small tolerance for floating point comparison
	const tolerance = 0.001

	switch {
	case currentPrice > trendlinePrice*(1+tolerance):
		// Price broke above resistance - confirmed breakout
		signal.Type = BreakoutConfirmed
		signal.Message = fmt.Sprintf(
			"Breakout above downtrend resistance at %.2f. Price: %.2f",
			trendlinePrice, currentPrice,
		)
		return signal

	case currentPrice <= trendlinePrice*(1+tolerance):
		// Price at or below resistance - potential breakout
		signal.Type = BreakoutPotential
		signal.Message = fmt.Sprintf(
			"At downtrend resistance %.2f. Price: %.2f",
			trendlinePrice, currentPrice,
		)
		return signal

	default:
		return nil
	}
}

// detectHistoricalCrosses scans price history and records all cross events for a set of trendlines.
// This matches TradingView behavior where crosses are shown throughout the chart history.
//
// For each bar, we check if price crossed from one side of the trendline to the other.
// A cross is detected when:
// - For support: price was above line, then closes below line
// - For resistance: price was below line, then closes above line
func (d *Detector) detectHistoricalCrosses(lines []Trendline, prices []*market.PriceData, currentIndex int) {
	if len(prices) == 0 {
		return
	}

	// For each trendline, scan from its start point to current bar
	for i := range lines {
		line := &lines[i]
		startIndex := line.StartPivot.Index

		// Scan each bar from trendline start to current
		var previousSide int // -1: below, 0: on, 1: above

		for j := startIndex; j <= currentIndex; j++ {
			if j >= len(prices) {
				break
			}

			bar := prices[j]
			linePrice := d.getTrendlinePrice(*line, j)

			// Determine which side of the line price is on
			// Use a small tolerance for "on the line"
			const tolerance = 0.001
			var currentSide int

			if bar.Close > linePrice*(1+tolerance) {
				currentSide = 1 // above
			} else if bar.Close < linePrice*(1-tolerance) {
				currentSide = -1 // below
			} else {
				currentSide = 0 // on the line
			}

			// Check for cross: side changed from previous bar
			// Skip first bar since we need a previous side to compare
			if j > startIndex {
				crossType := ""
				isCross := false

				if line.Type == UptrendSupport {
					// Support cross: price went from above to below
					if previousSide >= 0 && currentSide < 0 {
						crossType = "cross_below"
						isCross = true
					}
				} else { // DowntrendResistance
					// Resistance cross: price went from below to above
					if previousSide <= 0 && currentSide > 0 {
						crossType = "cross_above"
						isCross = true
					}
				}

				if isCross {
					line.Crosses = append(line.Crosses, CrossEvent{
						Index:     j,
						Date:      bar.Date,
						Price:     bar.Close,
						CrossType: crossType,
					})
				}
			}

			previousSide = currentSide
		}
	}
}

// createCrossSignal creates a signal for a historical cross event.
func (d *Detector) createCrossSignal(line Trendline, cross CrossEvent) *BullishSignal {
	signalType := NoSignal
	message := ""

	if line.Type == UptrendSupport {
		signalType = BouncePotential
		message = fmt.Sprintf(
			"Price crossed below uptrend support at %.2f on %s. Line from %.2f to %.2f",
			cross.Price, cross.Date, line.StartPivot.Low, line.EndPivot.Low,
		)
	} else {
		signalType = BreakoutConfirmed
		message = fmt.Sprintf(
			"Price crossed above downtrend resistance at %.2f on %s. Line from %.2f to %.2f",
			cross.Price, cross.Date, line.StartPivot.High, line.EndPivot.High,
		)
	}

	return &BullishSignal{
		Type:      signalType,
		Trendline: line,
		Price:     cross.Price,
		Time:      cross.Date,
		Message:   message,
	}
}

// GetActiveTrendlines returns all active trendlines for a symbol.
// Also detects historical crosses to properly set broken_at for trendlines that have been crossed.
func (d *Detector) GetActiveTrendlines(prices []*market.PriceData) (supportLines, resistanceLines []Trendline) {
	pivotHighs := d.findPricePivotHighs(prices, d.config.PivotLength)
	pivotLows := d.findPricePivotLows(prices, d.config.PivotLength)

	currentIndex := len(prices) - 1
	supportLines = d.createUptrendLinesPineStyle(pivotLows, currentIndex)
	resistanceLines = d.createDowntrendLinesPineStyle(pivotHighs, currentIndex)

	d.extendTrendlinesToCurrentBar(supportLines, currentIndex)
	d.extendTrendlinesToCurrentBar(resistanceLines, currentIndex)

	// Detect historical crosses for all trendlines
	// This ensures broken_at is properly set for trendlines that have been crossed
	d.detectHistoricalCrosses(supportLines, prices, currentIndex)
	d.detectHistoricalCrosses(resistanceLines, prices, currentIndex)

	return supportLines, resistanceLines
}
