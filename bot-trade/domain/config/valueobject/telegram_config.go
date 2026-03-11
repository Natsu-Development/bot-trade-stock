// Package valueobject provides immutable value objects for the config domain.
package valueobject

import "bot-trade/domain/shared"

// Telegram holds Telegram notification settings.
type Telegram struct {
	Enabled  bool   `json:"enabled" bson:"enabled"`
	BotToken string `json:"bot_token,omitempty" bson:"bot_token"`
	ChatID   string `json:"chat_id,omitempty" bson:"chat_id"`
}

// Validate checks telegram invariants.
func (t *Telegram) Validate() error {
	if !t.Enabled {
		return nil
	}
	if t.BotToken == "" {
		return shared.NewValidationError("telegram.bot_token is required when telegram is enabled")
	}
	if t.ChatID == "" {
		return shared.NewValidationError("telegram.chat_id is required when telegram is enabled")
	}
	return nil
}
