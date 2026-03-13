package outbound

import (
	"bot-trade/application/dto"
	"bot-trade/domain/analysis/valueobject"
	configvo "bot-trade/domain/config/valueobject"
)

// NotificationType represents the type of notification to send.
type NotificationType string

const (
	NotificationTypeDivergence  NotificationType = "divergence"
	NotificationTypeEarlySignal NotificationType = "early_signal"
)

// NotificationRequest represents a single notification request.
type NotificationRequest struct {
	Type           NotificationType
	DivergenceType valueobject.DivergenceType
	Interval       string
	Symbol         string
	Result         *dto.AnalysisResult
	Description    string
	IsEarlySignal  bool
	TelegramCfg    configvo.Telegram
}

// Notifier defines the interface for sending notifications.
// The infrastructure adapter decides whether to send based on the Telegram state.
type Notifier interface {
	SendNotification(req NotificationRequest) error
}
