package outbound

import "bot-trade/domain/aggregate/analysis"

// Notifier defines the interface for sending notifications.
type Notifier interface {
	HandleDivergenceResult(divergenceType analysis.DivergenceType, interval, symbol string, result *analysis.AnalysisResult, botToken, chatID string) error
	HandleEarlySignalResult(interval, symbol string, result *analysis.AnalysisResult, botToken, chatID string) error
}
