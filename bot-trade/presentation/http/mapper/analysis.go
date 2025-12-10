// Package mapper provides functions to convert domain entities to API response formats.
// This keeps presentation concerns out of the domain layer.
package mapper

import (
	"time"

	"bot-trade/domain/aggregate/analysis"
)

// AnalysisResultToJSON converts a domain AnalysisResult to API response format.
// This function handles the mapping from domain entity to presentation format,
// keeping the domain layer free from JSON/API concerns.
func AnalysisResultToJSON(r *analysis.AnalysisResult) map[string]interface{} {
	result := map[string]interface{}{
		"symbol":             r.Symbol(),
		"processing_time_ms": r.ProcessingTimeMs(),
		"timestamp":          r.Timestamp().Format(time.RFC3339),
		"parameters": map[string]interface{}{
			"start_date": r.Query().StartDate(),
			"end_date":   r.Query().EndDate(),
			"interval":   r.Query().IntervalString(),
			"rsi_period": r.RSIPeriod(),
		},
	}

	if r.Divergence() != nil {
		result["divergence"] = map[string]interface{}{
			"type":             r.Divergence().GetTypeString(),
			"description":      r.Divergence().Description(),
			"divergence_found": r.Divergence().DivergenceFound(),
			"current_price":    r.Divergence().CurrentPrice(),
			"current_rsi":      r.Divergence().CurrentRSI(),
			"detected_at":      r.Divergence().DetectedAt(),
		}
	}

	return result
}
