package telegram

import (
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// Notifier sends Telegram notifications
type Notifier struct {
	botToken string
	chatID   string
	enabled  bool
	client   *http.Client
}

// NewNotifier creates a new Telegram notifier
func NewNotifier(botToken, chatID string, enabled bool) *Notifier {
	return &Notifier{
		botToken: botToken,
		chatID:   chatID,
		enabled:  enabled,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SendMessage sends a message to Telegram
func (n *Notifier) SendMessage(message string) error {
	if !n.enabled {
		return nil // Silently skip if disabled
	}

	if n.botToken == "" || n.chatID == "" {
		return fmt.Errorf("telegram bot token or chat ID not configured")
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", n.botToken)

	data := url.Values{}
	data.Set("chat_id", n.chatID)
	data.Set("text", message)
	data.Set("parse_mode", "HTML")

	resp, err := n.client.PostForm(apiURL, data)
	if err != nil {
		return fmt.Errorf("failed to send telegram message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("telegram API returned status %d", resp.StatusCode)
	}

	return nil
}
