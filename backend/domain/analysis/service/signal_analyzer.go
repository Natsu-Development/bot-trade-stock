package service

import (
	"time"

	analysisvo "backend/domain/analysis/valueobject"
	configagg "backend/domain/config/aggregate"
	sharedservice "backend/domain/shared/service"
	marketvo "backend/domain/shared/valueobject/market"
)

// ComputeSignalFlags runs the trendline + RSI-divergence analysis for one symbol's
// bars under a single config and returns the six boolean screener flags as a
// VALUE. It serves the screener's per-config signals ONLY — the tick-time resistance/support
// levels are produced separately by ComputeAlertTrendline, so neither path computes work
// the other discards.
//
// It is pure: it never mutates the input bars slice nor any shared aggregate —
// CalculateRSI allocates a fresh slice, and every downstream reader works off
// that copy.
func ComputeSignalFlags(bars []marketvo.MarketData, cfg *configagg.TradingConfig) analysisvo.SignalFlags {
	var sig analysisvo.SignalFlags

	rsiPeriod := int(cfg.RSIPeriod)
	pivotPeriod := int(cfg.PivotPeriod)
	proximityPct := cfg.Trendline.ProximityDecimal()
	rangeMin := cfg.Divergence.RangeMin
	rangeMax := cfg.Divergence.RangeMax
	maxLines := cfg.Trendline.MaxLines
	signalThreshold := time.Now().AddDate(0, 0, -cfg.SignalDaysThreshold)

	if len(bars) < rsiPeriod+1 {
		return sig
	}

	// 1. Calculate RSI over the full fetched window. Analysis runs on the same
	// window (no post-RSI trim) — RSI=0 warmup bars are inert in pivot detection.
	dataWithRSI := sharedservice.CalculateRSI(bars, rsiPeriod)

	// 2. Find RSI pivots for divergence detection (must use FieldRSI). The price
	// pivots + trendline signals come from the shared trendlineSignals helper.
	rsiHighPivots := FindHighPivots(dataWithRSI, analysisvo.FieldRSI, pivotPeriod)
	rsiLowPivots := FindLowPivots(dataWithRSI, analysisvo.FieldRSI, pivotPeriod)

	// 3. Detect divergences using config values
	bullishDivergences := FindBullishDivergences(rsiLowPivots, rangeMin, rangeMax)
	bearishDivergences := FindBearishDivergences(rsiHighPivots, rangeMin, rangeMax)

	// Check divergence dates - use second pivot date (most recent point)
	if len(bullishDivergences) > 0 {
		latestDiv := bullishDivergences[0]
		if isSignalWithinDays(latestDiv.SecondPivot.Date, signalThreshold) {
			sig.HasBullishRSI = true
		}
	}

	if len(bearishDivergences) > 0 {
		latestDiv := bearishDivergences[0]
		if isSignalWithinDays(latestDiv.SecondPivot.Date, signalThreshold) {
			sig.HasBearishRSI = true
		}
	}

	// 4. Trendline breakout/breakdown signals (shared price-pivot pipeline).
	breakoutSignals, breakdownSignals := trendlineSignals(dataWithRSI, pivotPeriod, maxLines, proximityPct)

	// 5. Extract signal types with date threshold check
	for _, s := range breakdownSignals {
		if isSignalWithinDays(s.Time, signalThreshold) {
			switch s.Type {
			case analysisvo.BreakdownPotential:
				sig.HasBreakdownPotential = true
			case analysisvo.BreakdownConfirmed:
				sig.HasBreakdownConfirmed = true
			}
		}
	}

	for _, s := range breakoutSignals {
		if isSignalWithinDays(s.Time, signalThreshold) {
			switch s.Type {
			case analysisvo.BreakoutPotential:
				sig.HasBreakoutPotential = true
			case analysisvo.BreakoutConfirmed:
				sig.HasBreakoutConfirmed = true
			}
		}
	}

	return sig
}

// ComputeAlertTrendline returns the tick-time resistance/support levels (and the
// proximity they were computed at) for one symbol's bars under a single config.
// Levels are a pure function of the PRICE series: this path runs only the
// trendline pipeline (price pivots → trendlines → potential signals → nearest
// level) and skips the RSI + divergence work ComputeSignalFlags does for its flags.
// The watchlist alert store consumes the result; it is the only level source the
// tick evaluator fires on.
func ComputeAlertTrendline(bars []marketvo.MarketData, cfg *configagg.TradingConfig) analysisvo.AlertTrendline {
	var lv analysisvo.AlertTrendline
	if len(bars) == 0 {
		return lv
	}

	pivotPeriod := int(cfg.PivotPeriod)
	proximityPct := cfg.Trendline.ProximityDecimal()
	maxLines := cfg.Trendline.MaxLines

	// Trendline signals from the shared price-pivot pipeline (no RSI work).
	breakoutSignals, breakdownSignals := trendlineSignals(bars, pivotPeriod, maxLines, proximityPct)

	// Read each direction's POTENTIAL level straight from the generated signals —
	// see nearestLevelFromSignals for why a *_Potential signal's PriceLine is
	// exactly the level the evaluator can fire on.
	latestClose := bars[len(bars)-1].Close
	lv.Resistance = nearestLevelFromSignals(breakoutSignals, analysisvo.BreakoutPotential, latestClose)
	lv.Support = nearestLevelFromSignals(breakdownSignals, analysisvo.BreakdownPotential, latestClose)
	lv.Proximity = proximityPct

	return lv
}

// trendlineSignals runs the price-pivot → trendline → potential/confirmed signal
// pipeline shared by ComputeSignalFlags (which turns the signals into breakout/
// breakdown flags) and ComputeAlertTrendline (which reads the nearest level off them). It
// reads only price fields (High/Low/Close/Index/Date) and never the RSI field, so
// callers may pass either the raw bars or the RSI-augmented series interchangeably.
func trendlineSignals(data []marketvo.MarketData, pivotPeriod, maxLines int, proximityPct float64) (breakout, breakdown []analysisvo.Signal) {
	highPivots := FindHighPivots(data, analysisvo.FieldHigh, pivotPeriod)
	lowPivots := FindLowPivots(data, analysisvo.FieldLow, pivotPeriod)
	breakdown = GenerateSupportSignals(BuildSupportTrendlines(lowPivots, maxLines), data, proximityPct)
	breakout = GenerateResistanceSignals(BuildResistanceTrendlines(highPivots, maxLines), data, proximityPct)
	return breakout, breakdown
}

// nearestLevelFromSignals returns the PriceLine of the `want` *_Potential
// signal nearest latestClose, or 0 when none exists (the alert evaluator treats
// 0 as "no level to approach" and suppresses the alert).
//
// GenerateResistanceSignals / GenerateSupportSignals emit a *_Potential signal
// only for a line the latest close has NOT crossed — a crossed line emits
// *_Confirmed instead. So a BreakoutPotential's PriceLine is always
// >= latestClose and a BreakdownPotential's is always <= latestClose, and a
// single |PriceLine - latestClose| nearest-pick serves both directions. The
// caller just supplies the signal type it wants. PriceLine <= 0 is skipped
// defensively.
func nearestLevelFromSignals(signals []analysisvo.Signal, want analysisvo.SignalType, latestClose float64) float64 {
	best := 0.0
	bestDist := -1.0
	for _, s := range signals {
		if s.Type != want || s.PriceLine <= 0 {
			continue
		}
		dist := s.PriceLine - latestClose
		if dist < 0 {
			dist = -dist
		}
		if bestDist < 0 || dist < bestDist {
			bestDist = dist
			best = s.PriceLine
		}
	}
	return best
}

// isSignalWithinDays checks if a date string (YYYY-MM-DD) is within threshold.
func isSignalWithinDays(dateStr string, threshold time.Time) bool {
	if dateStr == "" {
		return false
	}
	signalDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return false
	}
	return signalDate.After(threshold) || signalDate.Equal(threshold)
}
