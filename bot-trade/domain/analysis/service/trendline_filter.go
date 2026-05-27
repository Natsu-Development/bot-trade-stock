package service

import (
	"bot-trade/domain/analysis/valueobject"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// IsIntact reports whether `bars` contains any Close that has crossed `line`
// on its breakage side between line.EndPivot.Index+1 and the last bar in
// `bars`. It is the boolean inversion of the existing findCrossingPoint{Above,
// Below} helpers — detection is delegated to those routines so the same
// convention drives both signal generation (GenerateSupportSignals /
// GenerateResistanceSignals) and level extraction
// (nearestPotential{Support,Resistance}Level via FilterIntactTrendlines).
//
// Detection is Close-based and symmetric: both findCrossingPointAbove and
// findCrossingPointBelow compare bar.Close to line.PriceAt(bar.Index). Line
// construction is asymmetric (priceFor reads Low for support pivots and High
// for resistance pivots). A wick that pierces a support line on bar.Low
// without closing through does NOT break the line.
//
// Edge cases (all return true → vacuously intact, matching findSliceIndex's
// "(0, false) → NotFound" contract in signal_generator.go):
//   - len(bars) == 0
//   - line.EndPivot.Index not present in `bars`
//   - line.EndPivot.Index is the last bar in `bars` (no post-pivot bars to
//     check)
//
// Crossings older than the recent-window slice are silently outside this
// check — by design, matching the signal generator's own window.
func IsIntact(line valueobject.Trendline, bars []marketvo.MarketData) bool {
	if len(bars) == 0 {
		return true
	}
	if line.Type.IsSupport() {
		return !findCrossingPointBelow(bars, line).Found
	}
	return !findCrossingPointAbove(bars, line).Found
}

// FilterIntactTrendlines returns the subset of `lines` that have not been
// crossed by Close since their EndPivot, evaluated against `bars`. It is a
// thin slice wrapper over IsIntact — see that function's godoc for detection
// semantics, the construction-vs-detection asymmetry, and edge-case behavior.
//
// The returned slice is a fresh allocation that preserves input order. The
// input slice is not mutated. Mixed support and resistance lines are
// supported.
func FilterIntactTrendlines(
	lines []valueobject.Trendline,
	bars []marketvo.MarketData,
) []valueobject.Trendline {
	out := make([]valueobject.Trendline, 0, len(lines))
	for _, line := range lines {
		if IsIntact(line, bars) {
			out = append(out, line)
		}
	}
	return out
}
