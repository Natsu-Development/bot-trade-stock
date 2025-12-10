package port

// DivergenceAlert represents alert data for divergence notifications.
type DivergenceAlert struct {
	Type        string
	Symbol      string
	Interval    string
	Description string
}

// Notifier defines the interface for sending notifications.
// This interface abstracts the notification mechanism, allowing different
// implementations (Telegram, Slack, email, etc.) to be used interchangeably.
type Notifier interface {
	// SendMessage sends a notification message.
	// Returns an error if the message could not be sent.
	SendMessage(message string) error

	// SendDivergenceAlert sends a formatted divergence alert.
	// The implementation handles the formatting specific to the notification channel.
	SendDivergenceAlert(alert DivergenceAlert) error

	// IsEnabled returns whether notifications are enabled.
	IsEnabled() bool
}
