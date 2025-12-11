package port

import "bot-trade/domain/aggregate/analysis"

// Notifier defines the interface for sending notifications.
// This interface abstracts the notification mechanism, allowing different
// implementations (Telegram, Slack, email, etc.) to be used interchangeably.
type Notifier interface {
	// HandleDivergenceResult processes and notifies about a divergence detection.
	// Returns error if notification fails, nil otherwise.
	HandleDivergenceResult(divergenceType analysis.DivergenceType, interval, symbol string, result *analysis.DivergenceResult) error
}
