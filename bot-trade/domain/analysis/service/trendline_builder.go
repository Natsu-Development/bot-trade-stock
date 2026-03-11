// Package service provides domain services for technical analysis.
package service

import (
	"bot-trade/domain/analysis/valueobject"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// takeRecent returns the last n trendlines.
func takeRecent(lines []valueobject.Trendline, n int) []valueobject.Trendline {
	if len(lines) <= n {
		return lines
	}
	return lines[len(lines)-n:]
}

// isValidSupportTrendline checks if two pivots form a valid support line.
// Requires rising lows: prev.Low < curr.Low
func isValidSupportTrendline(prev, curr marketvo.MarketData) bool {
	return prev.Low < curr.Low
}

// isValidResistanceTrendline checks if two pivots form a valid resistance line.
// Requires falling highs: prev.High > curr.High
func isValidResistanceTrendline(prev, curr marketvo.MarketData) bool {
	return prev.High > curr.High
}

// BuildSupportTrendlines builds uptrend support lines from pivot lows.
// Pure function - returns slice of Trendline value objects.
//
// Parameters:
//   - pivots: Pivot points to build trendlines from (already detected using pivotPeriod)
//   - maxLines: Maximum number of lines to keep (must be > 0)
//
// Returns: Slice of built support trendlines, limited to maxLines.
func BuildSupportTrendlines(
	pivots []marketvo.MarketData,
	maxLines int,
) []valueobject.Trendline {
	if maxLines <= 0 || len(pivots) < 2 {
		return nil
	}

	var lines []valueobject.Trendline
	for i := 1; i < len(pivots); i++ {
		prev, curr := pivots[i-1], pivots[i]

		if isValidSupportTrendline(prev, curr) {
			lines = append(lines, valueobject.NewTrendline(prev, curr, valueobject.UptrendSupport))
		}
	}

	return takeRecent(lines, maxLines)
}

// BuildResistanceTrendlines builds downtrend resistance lines from pivot highs.
// Pure function - returns slice of Trendline value objects.
//
// Parameters:
//   - pivots: Pivot points to build trendlines from (already detected using pivotPeriod)
//   - maxLines: Maximum number of lines to keep (must be > 0)
//
// Returns: Slice of built resistance trendlines, limited to maxLines.
func BuildResistanceTrendlines(
	pivots []marketvo.MarketData,
	maxLines int,
) []valueobject.Trendline {
	if maxLines <= 0 || len(pivots) < 2 {
		return nil
	}

	var lines []valueobject.Trendline
	for i := 1; i < len(pivots); i++ {
		prev, curr := pivots[i-1], pivots[i]

		if isValidResistanceTrendline(prev, curr) {
			lines = append(lines, valueobject.NewTrendline(prev, curr, valueobject.DowntrendResistance))
		}
	}

	return takeRecent(lines, maxLines)
}
