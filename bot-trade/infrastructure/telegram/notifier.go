package telegram

import (
	"fmt"
	"net/http"
	"net/url"
	"time"

	"bot-trade/domain/aggregate/analysis"
	"bot-trade/infrastructure/port"
)

// Ensure Notifier implements the port.Notifier interface
var _ port.Notifier = (*Notifier)(nil)

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
		return nil
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

// IsEnabled returns whether Telegram notifications are enabled.
func (n *Notifier) IsEnabled() bool {
	return n.enabled
}

// HandleDivergenceResult processes a divergence result and sends notification.
func (n *Notifier) HandleDivergenceResult(
	divergenceType analysis.DivergenceType,
	interval, symbol string,
	result *analysis.DivergenceResult,
) error {
	if result == nil || !result.DivergenceFound() || !n.enabled {
		return nil
	}

	message := FormatDivergenceAlert(divergenceType.String(), interval, symbol, result.Description())
	if err := n.SendMessage(message); err != nil {
		return fmt.Errorf("failed to send %s notification for %s [%s]: %w", 
			divergenceType.String(), symbol, interval, err)
	}

	return nil
}
