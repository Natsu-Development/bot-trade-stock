// Package config defines trading configuration domain aggregate.
package config

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

// ErrConfigNotFound indicates the requested config ID does not exist.
var ErrConfigNotFound = errors.New("configuration not found")

// ErrConfigValidation indicates the configuration failed validation.
var ErrConfigValidation = errors.New("configuration validation failed")

// TradingConfig represents a user's trading configuration.
type TradingConfig struct {
	ID                    string           `json:"id" bson:"_id"`
	RSIPeriod             int              `json:"rsi_period" bson:"rsi_period"`
	StartDateOffset       int              `json:"start_date_offset" bson:"start_date_offset"` // Days of historical data
	Divergence            DivergenceConfig `json:"divergence" bson:"divergence"`
	EarlyDetectionEnabled bool             `json:"early_detection_enabled" bson:"early_detection_enabled"` // Enable early bearish divergence detection
	BearishSymbols        []string         `json:"bearish_symbols" bson:"bearish_symbols"`                 // Holding stocks for exit signals
	BullishSymbols        []string                 `json:"bullish_symbols" bson:"bullish_symbols"`                         // Watchlist stocks for entry signals
	Telegram              TelegramConfig           `json:"telegram" bson:"telegram"`
	ScreenerFilterPresets []ScreenerFiltersConfig  `json:"screener_filters,omitempty" bson:"screener_filters,omitempty"` // Saved screener filter presets
	CreatedAt             time.Time                `json:"created_at" bson:"created_at"`
	UpdatedAt             time.Time                `json:"updated_at" bson:"updated_at"`
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

// ScreenerFilter represents a single filter condition for the stock screener.
type ScreenerFilter struct {
	Field    string `json:"field" bson:"field"`       // e.g., "rs_52w", "volume_vs_sma"
	Operator string `json:"op" bson:"op"`             // e.g., ">=", "<=", ">", "<", "="
	Value    int    `json:"value" bson:"value"`       // Filter threshold value
}

// ScreenerFiltersConfig holds saved screener filter presets.
type ScreenerFiltersConfig struct {
	Name      string           `json:"name" bson:"name"`                           // User-defined filter name
	Filters   []ScreenerFilter `json:"filters" bson:"filters"`                     // Filter conditions
	Logic     string           `json:"logic" bson:"logic"`                         // 'and' or 'or'
	Exchanges []string         `json:"exchanges,omitempty" bson:"exchanges,omitempty"` // Optional exchange filter
	CreatedAt time.Time        `json:"created_at" bson:"created_at"`
}

// Validate checks all trading config invariants.
func (c *TradingConfig) Validate() error {
	var errs []string

	if c.RSIPeriod <= 0 {
		errs = append(errs, "rsi_period must be a positive integer")
	}

	if c.StartDateOffset <= 0 {
		errs = append(errs, "start_date_offset must be a positive integer")
	}

	if err := c.Divergence.Validate(); err != nil {
		errs = append(errs, err.Error())
	}

	if len(c.BearishSymbols) == 0 && len(c.BullishSymbols) == 0 {
		errs = append(errs, "at least one of bearish_symbols or bullish_symbols must contain symbols")
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

// ValidateConfigID validates a config ID (username) format.
func ValidateConfigID(id string) error {
	trimmed := strings.TrimSpace(id)

	if trimmed == "" {
		return &ValidationError{Errors: []string{"config ID is required"}}
	}

	if len(trimmed) < 2 {
		return &ValidationError{Errors: []string{"config ID must be at least 2 characters"}}
	}

	if len(trimmed) > 50 {
		return &ValidationError{Errors: []string{"config ID must be less than 50 characters"}}
	}

	// Allow alphanumeric, hyphens, and underscores only
	validPattern := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !validPattern.MatchString(trimmed) {
		return &ValidationError{Errors: []string{"config ID can only contain letters, numbers, hyphens, and underscores"}}
	}

	return nil
}
