package outbound

import (
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/config"
)

// NotificationType represents the type of notification to send.
type NotificationType string

const (
	NotificationTypeDivergence NotificationType = "divergence"
	NotificationTypeEarlySignal NotificationType = "early_signal"
)

// NotificationRequest represents a single notification request.
type NotificationRequest struct {
	Type           NotificationType
	DivergenceType analysis.DivergenceType
	Interval       string
	Symbol         string
	Result         *analysis.AnalysisResult
	TelegramCfg    config.TelegramConfig
}

// Notifier defines the interface for sending notifications.
// The infrastructure adapter decides whether to send based on the TelegramConfig state.
type Notifier interface {
	SendNotification(req NotificationRequest) error
}
