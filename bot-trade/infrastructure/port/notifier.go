package port

import "bot-trade/domain/aggregate/analysis"

// Notifier defines the interface for sending notifications.
type Notifier interface {
	// HandleDivergenceResult processes and notifies about a divergence detection.
	HandleDivergenceResult(divergenceType analysis.DivergenceType, interval, symbol string, result *analysis.AnalysisResult) error
}
