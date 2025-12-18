// Package mapper provides functions to convert domain entities to API response formats.
package mapper

import (
	"time"

	"bot-trade/domain/aggregate/analysis"
)

// AnalysisResultToJSON converts a domain AnalysisResult to API response format.
func AnalysisResultToJSON(r *analysis.AnalysisResult) map[string]interface{} {
	return map[string]interface{}{
		"symbol":             r.Symbol,
		"processing_time_ms": r.ProcessingTimeMs,
		"timestamp":          r.Timestamp.Format(time.RFC3339),
		"parameters": map[string]interface{}{
			"start_date": r.StartDate,
			"end_date":   r.EndDate,
			"interval":   r.Interval,
			"rsi_period": r.RSIPeriod,
		},
		"divergence": map[string]interface{}{
			"type":             r.DivergenceType.String(),
			"description":      r.Description,
			"divergence_found": r.DivergenceFound,
			"current_price":    r.CurrentPrice,
			"current_rsi":      r.CurrentRSI,
		},
	}
}
