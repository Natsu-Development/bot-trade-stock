package outbound

import (
	"context"

	configvo "bot-trade/domain/config/valueobject"
)

// Message represents a notification message to send.
// Jobs build the content; infrastructure handles presentation (HTML formatting).
type Message struct {
	Title  string  // e.g., "Bullish Divergence Alert"
	Fields []Field // Structured content
}

// Field represents a key-value pair in a message.
type Field struct {
	Label string // e.g., "Symbol"
	Value string // e.g., "VCB"
}

// Notifier defines the interface for sending notifications.
// The infrastructure adapter decides whether to send based on the Telegram config.
type Notifier interface {
	Send(ctx context.Context, cfg configvo.Telegram, msg Message) error
}
