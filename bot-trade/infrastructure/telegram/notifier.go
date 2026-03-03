package telegram

import (
	"fmt"
	"net/http"
	"net/url"
	"time"

	"bot-trade/application/port/outbound"
	"bot-trade/domain/aggregate/analysis"
)

const (
	telegramAPIBaseURL    = "https://api.telegram.org"
	telegramClientTimeout = 10 * time.Second
)

var _ outbound.Notifier = (*Notifier)(nil)

// Notifier sends Telegram notifications.
type Notifier struct {
	client *http.Client
}

// NewNotifier creates a new Telegram notifier.
func NewNotifier() *Notifier {
	return &Notifier{
		client: &http.Client{
			Timeout: telegramClientTimeout,
		},
	}
}

// SendMessage sends a message to Telegram using provided credentials.
func (n *Notifier) SendMessage(botToken, chatID, message string) error {
	if botToken == "" || chatID == "" {
		return fmt.Errorf("telegram bot token or chat ID not configured")
	}

	apiURL := fmt.Sprintf("%s/bot%s/sendMessage", telegramAPIBaseURL, botToken)

	data := url.Values{}
	data.Set("chat_id", chatID)
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

// HandleDivergenceResult processes a divergence result and sends notification.
func (n *Notifier) HandleDivergenceResult(
	divergenceType analysis.DivergenceType,
	interval, symbol string,
	result *analysis.AnalysisResult,
	botToken, chatID string,
) error {
	if result == nil || !result.DivergenceFound {
		return nil
	}

	if botToken == "" || chatID == "" {
		return nil
	}

	message := FormatDivergenceAlert(divergenceType.String(), interval, symbol, result.Description)
	if err := n.SendMessage(botToken, chatID, message); err != nil {
		return fmt.Errorf("failed to send %s notification for %s [%s]: %w",
			divergenceType.String(), symbol, interval, err)
	}

	return nil
}

// HandleEarlySignalResult processes an early signal result and sends notification.
func (n *Notifier) HandleEarlySignalResult(
	interval, symbol string,
	result *analysis.AnalysisResult,
	botToken, chatID string,
) error {
	if result == nil || !result.EarlySignalDetected {
		return nil
	}

	if botToken == "" || chatID == "" {
		return nil
	}

	message := FormatEarlySignalAlert(interval, symbol, result.EarlyDescription)
	if err := n.SendMessage(botToken, chatID, message); err != nil {
		return fmt.Errorf("failed to send early signal notification for %s [%s]: %w",
			symbol, interval, err)
	}

	return nil
}
