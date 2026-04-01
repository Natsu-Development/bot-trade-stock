// Package aggregate defines trading configuration domain aggregate.
package aggregate

import (
	"time"

	"bot-trade/domain/config/valueobject"
	"bot-trade/domain/shared"
	"bot-trade/domain/shared/valueobject/market"
)

// TradingConfig represents a user's trading configuration.
// This is the aggregate root for the trading configuration bounded context.
type TradingConfig struct {
	ID          valueobject.ConfigID    `bson:"_id"`
	RSIPeriod   valueobject.RSIPeriod   `bson:"rsi_period"`
	PivotPeriod valueobject.PivotPeriod `bson:"pivot_period"`
	// LookbackDay specifies how many days of historical data to fetch for analysis.
	// Used to calculate the start date: time.Now().AddDate(0, 0, -int(LookbackDay))
	LookbackDay market.LookbackDay     `bson:"lookback_day"`
	Divergence  valueobject.Divergence `bson:"divergence"`
	Trendline   valueobject.Trendline  `bson:"trendline"`
	// IndicesRecent specifies the number of recent indices to track.
	IndicesRecent valueobject.IndicesRecent `bson:"indices_recent"`
	// BearishEarly enables early/unconfirmed bearish divergence detection.
	// Only applies to bearish divergence analysis; nil = disabled.
	BearishEarly   *bool                `bson:"bearish_early,omitempty"`
	BearishSymbols []market.Symbol      `bson:"bearish_symbols"`
	BullishSymbols []market.Symbol      `bson:"bullish_symbols"`
	Telegram       valueobject.Telegram `bson:"telegram"`
	// MetricsFilter holds user-saved screener filter configurations.
	// Nil = not set, empty array = user cleared their filters.
	MetricsFilter []valueobject.MetricsFilter `bson:"metrics_filter,omitempty"`
	CreatedAt   time.Time                 `bson:"created_at"`
	UpdatedAt   time.Time                 `bson:"updated_at"`
}

// NewTradingConfig creates a new TradingConfig with validation.
// Requires all configuration parameters to be explicitly provided.
func NewTradingConfig(
	id valueobject.ConfigID,
	rsiPeriod valueobject.RSIPeriod,
	pivotPeriod valueobject.PivotPeriod,
	lookbackDay market.LookbackDay,
	divergence valueobject.Divergence,
	trendline valueobject.Trendline,
	indicesRecent valueobject.IndicesRecent,
) (*TradingConfig, error) {
	cfg := &TradingConfig{
		ID:             id,
		RSIPeriod:      rsiPeriod,
		PivotPeriod:    pivotPeriod,
		LookbackDay:    lookbackDay,
		Divergence:     divergence,
		Trendline:      trendline,
		IndicesRecent:  indicesRecent,
		BearishSymbols: []market.Symbol{},
		BullishSymbols: []market.Symbol{},
		Telegram:       valueobject.Telegram{Enabled: false},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Merge combines a partial update into this config, returning a new config
// with all invariants validated. Only non-zero/empty fields from the update
// override existing values.
func (c *TradingConfig) Merge(update *TradingConfig) (*TradingConfig, error) {
	merged := *c // Shallow copy

	// Override primitive VOs if explicitly set
	var emptyRSI valueobject.RSIPeriod
	var emptyPivot valueobject.PivotPeriod
	var emptyOffset market.LookbackDay
	var emptyIndices valueobject.IndicesRecent

	if update.RSIPeriod != emptyRSI {
		merged.RSIPeriod = update.RSIPeriod
	}
	if update.PivotPeriod != emptyPivot {
		merged.PivotPeriod = update.PivotPeriod
	}
	if update.LookbackDay != emptyOffset {
		merged.LookbackDay = update.LookbackDay
	}
	if update.IndicesRecent != emptyIndices {
		merged.IndicesRecent = update.IndicesRecent
	}
	if update.BearishEarly != nil {
		merged.BearishEarly = update.BearishEarly
	}

	// Merge divergence config
	if update.Divergence.RangeMin > 0 {
		merged.Divergence.RangeMin = update.Divergence.RangeMin
	}
	if update.Divergence.RangeMax > 0 {
		merged.Divergence.RangeMax = update.Divergence.RangeMax
	}

	// Merge trendline config
	if update.Trendline.MaxLines > 0 {
		merged.Trendline.MaxLines = update.Trendline.MaxLines
	}
	if update.Trendline.ProximityPercent > 0 {
		merged.Trendline.ProximityPercent = update.Trendline.ProximityPercent
	}

	// Override symbol lists if provided (non-empty)
	if len(update.BearishSymbols) > 0 {
		merged.BearishSymbols = update.BearishSymbols
	}
	if len(update.BullishSymbols) > 0 {
		merged.BullishSymbols = update.BullishSymbols
	}

	// Merge telegram config - update if any telegram field is set
	if update.Telegram.Enabled || update.Telegram.BotToken != "" || update.Telegram.ChatID != "" {
		merged.Telegram.Enabled = update.Telegram.Enabled
		if update.Telegram.BotToken != "" {
			merged.Telegram.BotToken = update.Telegram.BotToken
		}
		if update.Telegram.ChatID != "" {
			merged.Telegram.ChatID = update.Telegram.ChatID
		}
	}

	// Always merge metrics_filter if provided (even if empty, to allow clearing)
	if update.MetricsFilter != nil {
		merged.MetricsFilter = update.MetricsFilter
	}

	merged.UpdatedAt = time.Now()

	if err := merged.Validate(); err != nil {
		return nil, err
	}

	return &merged, nil
}

// AddSymbol adds a symbol to the specified list (bullish/bearish).
// Idempotent: no error if the symbol already exists in the target list.
func (c *TradingConfig) AddSymbol(listType valueobject.WatchlistType, symbol market.Symbol) error {
	switch listType {
	case valueobject.WatchlistBullish:
		for _, s := range c.BullishSymbols {
			if s == symbol {
				return nil // Already exists, idempotent
			}
		}
		c.BullishSymbols = append(c.BullishSymbols, symbol)
	case valueobject.WatchlistBearish:
		for _, s := range c.BearishSymbols {
			if s == symbol {
				return nil // Already exists, idempotent
			}
		}
		c.BearishSymbols = append(c.BearishSymbols, symbol)
	default:
		return valueobject.ErrInvalidWatchlistType
	}

	c.UpdatedAt = time.Now()
	return nil
}

// RemoveSymbol removes a symbol from the specified list.
// Idempotent: no error if the symbol is not found in the target list.
func (c *TradingConfig) RemoveSymbol(listType valueobject.WatchlistType, symbol market.Symbol) error {
	switch listType {
	case valueobject.WatchlistBullish:
		found := false
		for i, s := range c.BullishSymbols {
			if s == symbol {
				c.BullishSymbols = append(c.BullishSymbols[:i], c.BullishSymbols[i+1:]...)
				found = true
				break
			}
		}
		if !found {
			return nil // Not found, idempotent
		}
	case valueobject.WatchlistBearish:
		found := false
		for i, s := range c.BearishSymbols {
			if s == symbol {
				c.BearishSymbols = append(c.BearishSymbols[:i], c.BearishSymbols[i+1:]...)
				found = true
				break
			}
		}
		if !found {
			return nil // Not found, idempotent
		}
	default:
		return valueobject.ErrInvalidWatchlistType
	}

	c.UpdatedAt = time.Now()
	return nil
}

// Validate checks all trading config invariants.
func (c *TradingConfig) Validate() error {
	var errs []string

	// Use guard clauses for simple required field checks
	var emptyRSI valueobject.RSIPeriod
	if c.RSIPeriod == emptyRSI {
		return shared.NewValidationError("rsi_period is required")
	}

	var emptyPivot valueobject.PivotPeriod
	if c.PivotPeriod == emptyPivot {
		return shared.NewValidationError("pivot_period is required")
	}

	// IndicesRecent is optional, but if set must be valid
	var emptyIndices valueobject.IndicesRecent
	if c.IndicesRecent != emptyIndices && c.IndicesRecent < 1 {
		errs = append(errs, "indices_recent must be a positive integer")
	}

	// Accumulate errors for nested object validations (may have multiple issues)
	if err := c.Divergence.Validate(); err != nil {
		errs = append(errs, err.Error())
	}
	if err := c.Trendline.Validate(); err != nil {
		errs = append(errs, err.Error())
	}
	if err := c.Telegram.Validate(); err != nil {
		errs = append(errs, err.Error())
	}

	if len(errs) > 0 {
		return shared.NewValidationError(errs...)
	}

	return nil
}
