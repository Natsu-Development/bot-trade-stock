// Package aggregate defines trading configuration domain aggregate.
package aggregate

import (
	"time"

	"backend/domain/config/valueobject"
	"backend/domain/shared"
	"backend/domain/shared/valueobject/market"
)

const (
	MinSignalDaysThreshold = 1
	MaxSignalDaysThreshold = 365
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
	// SignalDaysThreshold is the configured recency window (in days): a
	// trendline/RSI-divergence signal only counts when its most recent point falls
	// within this many days, not across the whole analyzed range.
	SignalDaysThreshold int                  `bson:"signal_days_threshold"`
	Telegram            valueobject.Telegram `bson:"telegram"`
	// MetricsFilter holds user-saved screener filter configurations.
	// Nil = not set, empty array = user cleared their filters.
	MetricsFilter []valueobject.MetricsFilter `bson:"metrics_filter,omitempty"`
	// Alerts holds user-configured price/volume alerts.
	// Nil = not set, empty array = user cleared their alerts.
	Alerts    []valueobject.StockAlertConfig `bson:"alerts,omitempty"`
	CreatedAt time.Time                      `bson:"created_at"`
	UpdatedAt time.Time                      `bson:"updated_at"`
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
	signalDaysThreshold int,
) (*TradingConfig, error) {
	cfg := &TradingConfig{
		ID:                  id,
		RSIPeriod:           rsiPeriod,
		PivotPeriod:         pivotPeriod,
		LookbackDay:         lookbackDay,
		Divergence:          divergence,
		Trendline:           trendline,
		IndicesRecent:       indicesRecent,
		SignalDaysThreshold: signalDaysThreshold,
		Telegram:            valueobject.Telegram{Enabled: false},
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
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
	// Zero is the sentinel for "not provided" — matches the pattern used for
	// every sibling VO above and preserves the partial-PUT semantics promised
	// by this method's doc comment. An explicit zero would be invalid anyway
	// (Validate rejects anything outside [MinSignalDaysThreshold, Max]), so
	// treating it as "absent" loses no legal input.
	if update.SignalDaysThreshold != 0 {
		merged.SignalDaysThreshold = update.SignalDaysThreshold
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

	// Always merge alerts if provided (even if empty, to allow clearing)
	if update.Alerts != nil {
		merged.Alerts = update.Alerts
	}

	merged.UpdatedAt = time.Now()

	if err := merged.Validate(); err != nil {
		return nil, err
	}

	return &merged, nil
}

// SymbolsWithEnabledCondition returns the symbols whose Alerts contain an enabled
// condition of the given type. Used by the analyze-job factories to derive their
// symbol set from divergence conditions (wrap in a SymbolSelector closure).
func (c *TradingConfig) SymbolsWithEnabledCondition(t valueobject.AlertType) []market.Symbol {
	var symbols []market.Symbol
	for _, alert := range c.Alerts {
		for _, cond := range alert.Conditions {
			if cond.Enabled && cond.Type == t {
				symbols = append(symbols, alert.Symbol)
				break
			}
		}
	}
	return symbols
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
	if c.SignalDaysThreshold < MinSignalDaysThreshold || c.SignalDaysThreshold > MaxSignalDaysThreshold {
		errs = append(errs, "signal_days_threshold must be between 1 and 365")
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

	for _, alert := range c.Alerts {
		if err := alert.Validate(); err != nil {
			errs = append(errs, err.Error())
		}
	}

	if len(errs) > 0 {
		return shared.NewValidationError(errs...)
	}

	return nil
}

// AddAlert appends or replaces an alert for the given symbol.
// If an alert for the same symbol already exists, it is replaced.
func (c *TradingConfig) AddAlert(alert valueobject.StockAlertConfig) error {
	if err := alert.Validate(); err != nil {
		return err
	}

	for i, existing := range c.Alerts {
		if existing.Symbol == alert.Symbol {
			c.Alerts[i] = alert
			c.UpdatedAt = time.Now()
			return nil
		}
	}
	c.Alerts = append(c.Alerts, alert)
	c.UpdatedAt = time.Now()
	return nil
}

// RemoveAlert removes an alert for the given symbol.
// Idempotent: returns nil if no alert exists for the symbol.
func (c *TradingConfig) RemoveAlert(symbol market.Symbol) error {
	for i, existing := range c.Alerts {
		if existing.Symbol == symbol {
			c.Alerts = append(c.Alerts[:i], c.Alerts[i+1:]...)
			c.UpdatedAt = time.Now()
			return nil
		}
	}
	return nil
}
