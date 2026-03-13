package telegram

import (
	"fmt"
	"net/http"
	"net/url"
	"time"

	"bot-trade/application/port/outbound"
	analysisvo "bot-trade/domain/analysis/valueobject"
	configvo "bot-trade/domain/config/valueobject"

	"go.mongodb.org/mongo-driver/bson/primitive"
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

// SendNotification sends a notification based on the request type.
// Implements the single-method Notifier interface per KISS principle.
func (n *Notifier) SendNotification(req outbound.NotificationRequest) error {
	if !req.TelegramCfg.Enabled {
		return nil
	}

	switch req.Type {
	case outbound.NotificationTypeDivergence:
		return n.sendDivergenceNotification(req.DivergenceType, req.Interval, req.Symbol, req.Description, req.TelegramCfg)
	case outbound.NotificationTypeEarlySignal:
		return n.sendEarlySignalNotification(req.Interval, req.Symbol, req.Description, req.TelegramCfg)
	default:
		return fmt.Errorf("unknown notification type: %s", req.Type)
	}
}

// sendDivergenceNotification sends a divergence notification.
func (n *Notifier) sendDivergenceNotification(
	divergenceType analysisvo.DivergenceType,
	interval, symbol, description string,
	telegramCfg configvo.Telegram,
) error {
	message := FormatDivergenceAlert(divergenceType, interval, symbol, description)
	if err := n.SendMessage(telegramCfg.BotToken, telegramCfg.ChatID, message); err != nil {
		return fmt.Errorf("failed to send %s notification for %s [%s]: %w",
			divergenceType, symbol, interval, err)
	}

	return nil
}

// sendEarlySignalNotification sends an early signal notification.
func (n *Notifier) sendEarlySignalNotification(
	interval, symbol, description string,
	telegramCfg configvo.Telegram,
) error {
	message := FormatEarlySignalAlert(interval, symbol, description)
	if err := n.SendMessage(telegramCfg.BotToken, telegramCfg.ChatID, message); err != nil {
		return fmt.Errorf("failed to send early signal notification for %s [%s]: %w",
			symbol, interval, err)
	}

	return nil
}

// ObjectId returns the MongoDB ObjectID from a string ID.
func ObjectId(id string) primitive.ObjectID {
	oid, _ := primitive.ObjectIDFromHex(id)
	return oid
}
