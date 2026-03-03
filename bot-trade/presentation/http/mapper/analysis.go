// Package mapper provides functions to convert domain entities to API response formats.
package mapper

import (
	"sort"
	"time"

	"bot-trade/domain/aggregate/market"
)

// DivergenceResultWrapperToJSON converts a DivergenceResultWrapper to API response format.
func DivergenceResultWrapperToJSON(r *market.DivergenceResultWrapper) map[string]interface{} {
	if r == nil {
		return nil
	}

	result := map[string]interface{}{
		"processing_time_ms": r.ProcessingTimeMs,
		"timestamp":          r.Timestamp.Format(time.RFC3339),
		"parameters": map[string]interface{}{
			"start_date": r.StartDate,
			"end_date":   r.EndDate,
			"interval":   r.Interval,
			"rsi_period": r.RSIPeriod,
		},
		"divergence": map[string]interface{}{
			"type":             r.DivergenceType,
			"description":      r.Description,
			"divergence_found": r.DivergenceFound,
			"current_price":    r.CurrentPrice,
			"current_rsi":      r.CurrentRSI,
		},
	}

	// Add early signal fields if present (for bearish divergence)
	if r.EarlySignal {
		result["early_signal"] = map[string]interface{}{
			"detected":    r.EarlySignal,
			"description": r.EarlyDescription,
		}
	}

	return result
}

// CombinedAnalysisResultToJSON converts a domain CombinedAnalysisResult to API response format.
func CombinedAnalysisResultToJSON(r *market.CombinedAnalysisResult) map[string]interface{} {
	if r == nil {
		return map[string]interface{}{
			"error": "nil result",
		}
	}

	// Sort signals by time to ensure chronological order
	signals := r.Signals
	sort.Slice(signals, func(i, j int) bool {
		return signals[i].Time < signals[j].Time
	})

	signalsJSON := make([]map[string]interface{}, 0, len(signals))
	for _, s := range signals {
		signalsJSON = append(signalsJSON, TradingSignalToJSON(s))
	}

	// Convert price history to JSON format
	priceHistoryJSON := make([]map[string]interface{}, 0)
	if r.PriceHistory != nil {
		for _, p := range r.PriceHistory {
			if p != nil {
				priceHistoryJSON = append(priceHistoryJSON, map[string]interface{}{
					"date":   p.Date,
					"open":   p.Open,
					"high":   p.High,
					"low":    p.Low,
					"close":  p.Close,
					"volume": p.Volume,
				})
			}
		}
	}

	response := map[string]interface{}{
		"symbol":             r.Symbol,
		"processing_time_ms": r.ProcessingTimeMs,
		"timestamp":          r.Timestamp.Format(time.RFC3339),
		"parameters": map[string]interface{}{
			"start_date":    r.StartDate,
			"end_date":      r.EndDate,
			"interval":      r.Interval,
			"current_price": r.CurrentPrice,
		},
		"bullish_divergence": DivergenceResultWrapperToJSON(r.BullishDivergence),
		"bearish_divergence": DivergenceResultWrapperToJSON(r.BearishDivergence),
		"signals":            signalsJSON,
		"signals_count":      len(r.Signals),
		"has_confirmed":      r.HasConfirmedSignals(),
		"has_watching":       len(r.GetWatchingSignals()) > 0,
		"price_history":      priceHistoryJSON,
	}

	// Convert trendlines to JSON with pre-calculated data points
	trendlinesJSON := make([]map[string]interface{}, 0, len(r.Trendlines))
	for _, t := range r.Trendlines {
		dataPointsJSON := make([]map[string]interface{}, 0, len(t.DataPoints))
		for _, dp := range t.DataPoints {
			dataPointsJSON = append(dataPointsJSON, map[string]interface{}{
				"date":  dp.Date,
				"price": dp.Price,
			})
		}

		// Build trendline JSON
		trendlineMap := map[string]interface{}{
			"type":         t.Type,
			"data_points":  dataPointsJSON,
			"start_price":  t.StartPrice,
			"end_price":    t.EndPrice,
			"start_date":   t.StartDate,
			"end_date":     t.EndDate,
			"slope":        t.Slope,
		}

		// Add broken_at and broken_type if the trendline was crossed
		if t.BrokenAt != nil {
			trendlineMap["broken_at"] = *t.BrokenAt
		}
		if t.BrokenType != nil {
			trendlineMap["broken_type"] = *t.BrokenType
		}

		trendlinesJSON = append(trendlinesJSON, trendlineMap)
	}
	response["trendlines"] = trendlinesJSON

	return response
}

// TradingSignalToJSON converts a domain TradingSignal to API response format.
func TradingSignalToJSON(s market.TradingSignal) map[string]interface{} {
	result := map[string]interface{}{
		"id":           s.ID,
		"type":         string(s.Type),
		"signal_level": s.SignalLevel.String(),
		"price":        s.Price,
		"message":      s.Message,
		"source":       s.Source,
		"time":         s.Time,
	}

	if s.Target > 0 {
		result["target"] = s.Target
	}
	if s.StopLoss > 0 {
		result["stop_loss"] = s.StopLoss
	}
	if s.Trendline != nil {
		result["trendline"] = map[string]interface{}{
			"type":               s.Trendline.Type,
			"start_price":        s.Trendline.StartPrice,
			"end_price":          s.Trendline.EndPrice,
			"start_date":         s.Trendline.StartDate,
			"end_date":           s.Trendline.EndDate,
			"current_line_price": s.Trendline.CurrentLinePrice,
			"slope":              s.Trendline.Slope,
		}
	}
	if s.Interval != "" {
		result["interval"] = s.Interval
	}

	return result
}
