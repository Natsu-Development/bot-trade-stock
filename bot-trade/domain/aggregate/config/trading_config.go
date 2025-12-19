// Package config defines trading configuration domain aggregate.
package config

import (
	"errors"
	"time"
)

// ErrConfigNotFound indicates the requested config ID does not exist.
var ErrConfigNotFound = errors.New("configuration not found")

// ErrConfigValidation indicates the configuration failed validation.
var ErrConfigValidation = errors.New("configuration validation failed")

// TradingConfig represents a user's trading configuration.
type TradingConfig struct {
	ID         string           `json:"id" bson:"_id"`
	RSIPeriod  int              `json:"rsi_period" bson:"rsi_period"`
	Divergence DivergenceConfig `json:"divergence" bson:"divergence"`
	Symbols    []string         `json:"symbols" bson:"symbols"`
	Telegram   TelegramConfig   `json:"telegram" bson:"telegram"`
	CreatedAt  time.Time        `json:"created_at" bson:"created_at"`
	UpdatedAt  time.Time        `json:"updated_at" bson:"updated_at"`
}

// DivergenceConfig holds divergence detection parameters.
type DivergenceConfig struct {
	LookbackLeft  int `json:"lookback_left" bson:"lookback_left"`
	LookbackRight int `json:"lookback_right" bson:"lookback_right"`
	RangeMin      int `json:"range_min" bson:"range_min"`
	RangeMax      int `json:"range_max" bson:"range_max"`
	IndicesRecent int `json:"indices_recent" bson:"indices_recent"`
}

// TelegramConfig holds Telegram notification settings.
type TelegramConfig struct {
	Enabled  bool   `json:"enabled" bson:"enabled"`
	BotToken string `json:"bot_token,omitempty" bson:"bot_token"`
	ChatID   string `json:"chat_id,omitempty" bson:"chat_id"`
}

// Validate checks all trading config invariants.
func (c *TradingConfig) Validate() error {
	var errs []string

	if c.RSIPeriod <= 0 {
		errs = append(errs, "rsi_period must be a positive integer")
	}

	if err := c.Divergence.Validate(); err != nil {
		errs = append(errs, err.Error())
	}

	if len(c.Symbols) == 0 {
		errs = append(errs, "symbols must contain at least one symbol")
	}

	if err := c.Telegram.Validate(); err != nil {
		errs = append(errs, err.Error())
	}

	if len(errs) > 0 {
		return &ValidationError{Errors: errs}
	}

	return nil
}

// Validate checks divergence config invariants.
func (d *DivergenceConfig) Validate() error {
	var errs []string

	if d.LookbackLeft <= 0 {
		errs = append(errs, "divergence.lookback_left must be a positive integer")
	}
	if d.LookbackRight <= 0 {
		errs = append(errs, "divergence.lookback_right must be a positive integer")
	}
	if d.RangeMin <= 0 {
		errs = append(errs, "divergence.range_min must be a positive integer")
	}
	if d.RangeMax <= 0 {
		errs = append(errs, "divergence.range_max must be a positive integer")
	}
	if d.RangeMin > d.RangeMax {
		errs = append(errs, "divergence.range_min must be less than or equal to range_max")
	}
	if d.IndicesRecent <= 0 {
		errs = append(errs, "divergence.indices_recent must be a positive integer")
	}

	if len(errs) > 0 {
		return &ValidationError{Errors: errs}
	}

	return nil
}

// Validate checks telegram config invariants.
func (t *TelegramConfig) Validate() error {
	if t.Enabled {
		var errs []string
		if t.BotToken == "" {
			errs = append(errs, "telegram.bot_token is required when telegram is enabled")
		}
		if t.ChatID == "" {
			errs = append(errs, "telegram.chat_id is required when telegram is enabled")
		}
		if len(errs) > 0 {
			return &ValidationError{Errors: errs}
		}
	}
	return nil
}

// ValidationError contains multiple validation errors.
type ValidationError struct {
	Errors []string
}

func (e *ValidationError) Error() string {
	if len(e.Errors) == 1 {
		return e.Errors[0]
	}
	result := "validation errors: "
	for i, err := range e.Errors {
		if i > 0 {
			result += "; "
		}
		result += err
	}
	return result
}
