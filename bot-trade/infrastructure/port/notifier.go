package port

import "bot-trade/domain/aggregate/analysis"

// Notifier defines the interface for sending notifications.
type Notifier interface {
	// HandleDivergenceResult processes and notifies about a divergence detection.
	// botToken and chatID are the Telegram credentials for sending notifications.
	HandleDivergenceResult(divergenceType analysis.DivergenceType, interval, symbol string, result *analysis.AnalysisResult, botToken, chatID string) error
}
