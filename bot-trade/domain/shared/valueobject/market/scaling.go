// Package market — scaling.go provides cadence-aware lookback math.
package market

// EffectiveLookbackDays scales lookbackDay by the calendar-day cadence implied
// by interval. Pure — no I/O, no logging, no cap.
//
// Why: LookbackDay is interpreted as calendar days by calculateDateRange
// (query.go:57). With a daily-tuned LookbackDay (e.g., 60), weekly fetches
// return ~8 bars and monthly ~2, starving the RSI / pivot / divergence
// pipeline. Scaling translates a "bar-count" intent across cadences:
// 60 daily bars ≈ 60 calendar days; 60 weekly bars ≈ 420 calendar days;
// 60 monthly bars ≈ 1800 calendar days.
//
// The result MUST stay within MaxLookbackDay for the resolved date window
// to satisfy calculateDateRange's re-assertion (query.go:64-66). With
// MaxLookbackDay=10000 and the largest realistic configs (1M × ~333 ≈ 9990)
// this is comfortably satisfied. Values beyond that are rejected by
// calculateDateRange — by design — surfacing absurd inputs loudly rather
// than silently truncating.
func EffectiveLookbackDays(i Interval, lookbackDay LookbackDay) LookbackDay {
	return LookbackDay(float64(lookbackDay) * daysPerBar(i))
}
