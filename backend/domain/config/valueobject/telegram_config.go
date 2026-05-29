// Package valueobject provides immutable value objects for the config domain.
package valueobject

import "bot-trade/domain/shared"

// Telegram holds Telegram notification settings.
type Telegram struct {
	Enabled  bool   `bson:"enabled"`
	BotToken string `bson:"bot_token"`
	ChatID   string `bson:"chat_id"`
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
