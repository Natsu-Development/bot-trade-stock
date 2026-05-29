// Package service contains domain services for the config bounded context.
package service

import (
	"fmt"

	configvo "backend/domain/config/valueobject"
	metricsagg "backend/domain/metrics/aggregate"
	marketvo "backend/domain/shared/valueobject/market"
)

// EvaluationResult carries the formatted output of a fired alert condition.
// Layer-neutral; the application layer projects it into outbound.Field.
type EvaluationResult struct {
	Label string
	Value string
}

// AlertEvaluator evaluates alert conditions against market data + cached metrics.
// Stateless today; struct shape is reserved for future caches/strategies/registries
// as the number of AlertType variants grows.
type AlertEvaluator struct{}

// NewAlertEvaluator constructs a new AlertEvaluator. Wire calls this once at startup
// and injects the singleton into the alert job.
func NewAlertEvaluator() *AlertEvaluator {
	return &AlertEvaluator{}
}

// Evaluate returns (result, true) when the condition fires; (zero, false) otherwise.
// SINGLE switch over AlertType in the whole codebase — both the fire/no-fire decision
// AND the value formatting live here. Callers (application, infra) never re-inspect type.
//
// prevQuote is used only by AlertTypeTransactionVolumeSpike — pass a zero-value
// MarketQuote for other types.
// metrics may be nil; volume_spike returns (zero, false) in that case.
func (e *AlertEvaluator) Evaluate(
	cond configvo.AlertCondition,
	quote marketvo.MarketQuote,
	prevQuote marketvo.MarketQuote,
	metrics *metricsagg.StockMetrics,
) (EvaluationResult, bool) {
	switch cond.Type {
	case configvo.AlertTypePriceAbove:
		if quote.MatchedPrice > cond.Threshold {
			return EvaluationResult{
				Label: configvo.LabelPriceAbove,
				Value: fmt.Sprintf("%.2f > %.2f", quote.MatchedPrice, cond.Threshold),
			}, true
		}
	case configvo.AlertTypePriceBelow:
		if quote.MatchedPrice < cond.Threshold {
			return EvaluationResult{
				Label: configvo.LabelPriceBelow,
				Value: fmt.Sprintf("%.2f < %.2f", quote.MatchedPrice, cond.Threshold),
			}, true
		}
	case configvo.AlertTypeVolumeSpike:
		if metrics == nil || metrics.VolumeSMA20 <= 0 {
			return EvaluationResult{}, false
		}
		pct := float64(quote.TotalTradedQty) / float64(metrics.VolumeSMA20) * 100
		if pct >= cond.Threshold {
			return EvaluationResult{
				Label: configvo.LabelVolumeSpike,
				Value: fmt.Sprintf("%.0f%% ≥ %.0f%% SMA20 (vol %d vs avg %d)",
					pct, cond.Threshold, quote.TotalTradedQty, metrics.VolumeSMA20),
			}, true
		}
	case configvo.AlertTypeTransactionVolumeSpike:
		delta, valid := quote.MatchedVolumeDelta(prevQuote)
		if !valid || delta < int64(cond.Threshold) {
			return EvaluationResult{}, false
		}
		dir := quote.ClassifyDirection()
		if dir == marketvo.DirectionNeutral {
			return EvaluationResult{}, false
		}
		bidDepth := quote.Best1BidVol + quote.Best2BidVol + quote.Best3BidVol
		askDepth := quote.Best1OfferVol + quote.Best2OfferVol + quote.Best3OfferVol
		return EvaluationResult{
			Label: configvo.LabelMatchedVolumeBurst,
			Value: fmt.Sprintf("%s %d shares ≥ %.0f @ %.2f (book: bid %d / ask %d)",
				dir, delta, cond.Threshold, quote.MatchedPrice, bidDepth, askDepth),
		}, true
	case configvo.AlertTypeTrendlineBreakout:
		// POTENTIAL ONLY — fire in the approach zone on the not-yet-broken side.
		// Price strictly above ResistanceLevel (broken through) does NOT fire.
		if metrics == nil || metrics.ResistanceLevel <= 0 {
			return EvaluationResult{}, false
		}
		level := metrics.ResistanceLevel
		lower := level * (1 - metrics.TrendlineProximity)
		if quote.MatchedPrice >= lower && quote.MatchedPrice <= level {
			return EvaluationResult{
				Label: configvo.LabelTrendlineBreakout,
				Value: fmt.Sprintf("%.2f approaching resistance %.2f", quote.MatchedPrice, level),
			}, true
		}
	case configvo.AlertTypeTrendlineBreakdown:
		// POTENTIAL ONLY — fire in the approach zone on the not-yet-broken side.
		// Price strictly below SupportLevel (broken through) does NOT fire.
		if metrics == nil || metrics.SupportLevel <= 0 {
			return EvaluationResult{}, false
		}
		level := metrics.SupportLevel
		upper := level * (1 + metrics.TrendlineProximity)
		if quote.MatchedPrice <= upper && quote.MatchedPrice >= level {
			return EvaluationResult{
				Label: configvo.LabelTrendlineBreakdown,
				Value: fmt.Sprintf("%.2f approaching support %.2f", quote.MatchedPrice, level),
			}, true
		}
	case configvo.AlertTypePriceCrossAbove:
		ma, ok := resolveMA(cond.Reference, metrics)
		if !ok || prevQuote.MatchedPrice <= 0 {
			return EvaluationResult{}, false
		}
		if prevQuote.MatchedPrice <= ma && quote.MatchedPrice > ma {
			return EvaluationResult{
				Label: configvo.LabelPriceCrossAbove,
				Value: fmt.Sprintf("%s %.2f: %.2f → %.2f", cond.Reference, ma, prevQuote.MatchedPrice, quote.MatchedPrice),
			}, true
		}
	case configvo.AlertTypePriceCrossBelow:
		ma, ok := resolveMA(cond.Reference, metrics)
		if !ok || prevQuote.MatchedPrice <= 0 {
			return EvaluationResult{}, false
		}
		if prevQuote.MatchedPrice >= ma && quote.MatchedPrice < ma {
			return EvaluationResult{
				Label: configvo.LabelPriceCrossBelow,
				Value: fmt.Sprintf("%s %.2f: %.2f → %.2f", cond.Reference, ma, prevQuote.MatchedPrice, quote.MatchedPrice),
			}, true
		}
	}
	// Analyze-only types (RSI divergence + multi-timeframe trendline) are owned by
	// the analyze jobs; the tick evaluator never fires them.
	return EvaluationResult{}, false
}

// resolveMA returns the cached moving-average value for the given reference.
// Returns (0,false) when metrics is nil, the reference is unknown, or the MA is non-positive.
func resolveMA(reference string, metrics *metricsagg.StockMetrics) (float64, bool) {
	if metrics == nil {
		return 0, false
	}
	var ma float64
	switch configvo.MAReference(reference) {
	case configvo.MAReferenceEMA9:
		ma = metrics.EMA9
	case configvo.MAReferenceEMA21:
		ma = metrics.EMA21
	case configvo.MAReferenceEMA50:
		ma = metrics.EMA50
	case configvo.MAReferenceSMA200:
		ma = metrics.SMA200
	default:
		return 0, false
	}
	if ma <= 0 {
		return 0, false
	}
	return ma, true
}
