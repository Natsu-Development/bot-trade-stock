// Package service contains domain services for the config bounded context.
package service

import (
	"fmt"

	configvo "bot-trade/domain/config/valueobject"
	metricsagg "bot-trade/domain/metrics/aggregate"
	marketvo "bot-trade/domain/shared/valueobject/market"
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
				Value: fmt.Sprintf("%.0f > %.0f", quote.MatchedPrice, cond.Threshold),
			}, true
		}
	case configvo.AlertTypePriceBelow:
		if quote.MatchedPrice < cond.Threshold {
			return EvaluationResult{
				Label: configvo.LabelPriceBelow,
				Value: fmt.Sprintf("%.0f < %.0f", quote.MatchedPrice, cond.Threshold),
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
	}
	return EvaluationResult{}, false
}
