package telegram

import (
	"context"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"bot-trade/application/port/outbound"
	configvo "bot-trade/domain/config/valueobject"
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

// Send formats the message to HTML and sends it via Telegram.
// Implements the outbound.Notifier interface.
func (n *Notifier) Send(ctx context.Context, cfg configvo.Telegram, msg outbound.Message) error {
	if !cfg.Enabled {
		return nil
	}

	body := formatMessage(msg)
	if err := n.SendMessage(cfg.BotToken, cfg.ChatID, body); err != nil {
		return fmt.Errorf("failed to send notification '%s': %w", msg.Title, err)
	}
	return nil
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
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("telegram API returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return nil
}

// formatMessage formats a Message to HTML for Telegram.
// Field text is HTML-escaped because Telegram parses the body with parse_mode=HTML
// and would 400 on raw "<" / ">" / "&" in user-supplied content.
func formatMessage(msg outbound.Message) string {
	icon := iconForTitle(msg.Title)
	var b strings.Builder

	b.WriteString(fmt.Sprintf("%s <b>%s</b>\n\n", icon, html.EscapeString(msg.Title)))
	for _, f := range msg.Fields {
		b.WriteString(fmt.Sprintf("%s <b>%s:</b> %s\n",
			iconForLabel(f.Label),
			html.EscapeString(f.Label),
			html.EscapeString(f.Value),
		))
	}

	return b.String()
}

// iconForTitle returns an icon based on the message title.
func iconForTitle(title string) string {
	if strings.Contains(title, "Bullish") {
		return "🟢"
	}
	if strings.Contains(title, "Bearish") {
		return "🔴"
	}
	if strings.Contains(title, "Stock Alert") {
		return "🔔"
	}
	return "⚠️" // Default for Early Signal, etc.
}

// iconForLabel returns an icon based on the field label.
// Alert-condition labels read from configvo.Label* so the domain owns the
// canonical display name; the icon-to-label mapping stays in infra.
func iconForLabel(label string) string {
	switch label {
	case "Symbol":
		return "📊"
	case "Interval":
		return "⏱"
	case "Description":
		return "📉"
	case "Price":
		return "💰"
	case configvo.LabelPriceAbove:
		return "📈"
	case configvo.LabelPriceBelow:
		return "📉"
	case configvo.LabelVolumeSpike:
		return "🚀"
	case configvo.LabelMatchedVolumeBurst:
		return "⚡"
	case configvo.LabelTrendlineBreakout:
		return "📈"
	case configvo.LabelTrendlineBreakdown:
		return "📉"
	case configvo.LabelPriceCrossAbove:
		return "🔼"
	case configvo.LabelPriceCrossBelow:
		return "🔽"
	case configvo.LabelBullishDivergence:
		return "🟢"
	case configvo.LabelBearishDivergence:
		return "🔴"
	default:
		return "•"
	}
}
