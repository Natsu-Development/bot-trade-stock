// Package valueobject provides immutable value objects for the config domain.
package valueobject

import (
	"errors"
	"strconv"
	"strings"

	"bot-trade/domain/shared"
	"bot-trade/domain/shared/valueobject/market"
)

var (
	ErrInvalidAlertType      = errors.New("alert type must be 'price_above', 'price_below', 'volume_spike', or 'transaction_volume_spike'")
	ErrInvalidAlertThreshold = errors.New("alert threshold must be greater than 0")
)

// AlertType identifies the kind of alert condition.
type AlertType string

const (
	AlertTypePriceAbove             AlertType = "price_above"
	AlertTypePriceBelow             AlertType = "price_below"
	AlertTypeVolumeSpike            AlertType = "volume_spike"
	AlertTypeTransactionVolumeSpike AlertType = "transaction_volume_spike"
)

// Canonical display labels for each AlertType. Single source of truth for
// notification rendering (telegram notifier reads them via configvo.Label*).
const (
	LabelPriceAbove         = "Price Above"
	LabelPriceBelow         = "Price Below"
	LabelVolumeSpike        = "Volume Spike"
	LabelMatchedVolumeBurst = "Matched Volume Burst"
)

// NewAlertType creates a validated AlertType.
func NewAlertType(value string) (AlertType, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	at := AlertType(normalized)
	switch at {
	case AlertTypePriceAbove, AlertTypePriceBelow, AlertTypeVolumeSpike, AlertTypeTransactionVolumeSpike:
		return at, nil
	default:
		return "", ErrInvalidAlertType
	}
}

// AlertCondition defines a single price/volume condition for a stock alert.
type AlertCondition struct {
	Type      AlertType `bson:"type"`
	Threshold float64   `bson:"threshold"`
	Enabled   bool      `bson:"enabled"`
}

// NewAlertCondition creates a validated AlertCondition.
func NewAlertCondition(alertType string, threshold float64, enabled bool) (AlertCondition, error) {
	at, err := NewAlertType(alertType)
	if err != nil {
		return AlertCondition{}, err
	}
	if threshold <= 0 {
		return AlertCondition{}, ErrInvalidAlertThreshold
	}
	return AlertCondition{Type: at, Threshold: threshold, Enabled: enabled}, nil
}

// Validate checks AlertCondition invariants.
func (c AlertCondition) Validate() error {
	if _, err := NewAlertType(string(c.Type)); err != nil {
		return err
	}
	if c.Threshold <= 0 {
		return ErrInvalidAlertThreshold
	}
	return nil
}

// StockAlertConfig groups conditions for a single symbol on a user's config.
// A fully-disabled alert (every condition.Enabled == false) is a paused state,
// not an invalid state — operators may keep alerts around without firing them.
type StockAlertConfig struct {
	Symbol     market.Symbol    `bson:"symbol"`
	Conditions []AlertCondition `bson:"conditions"`
}

// NewStockAlertConfig creates a validated StockAlertConfig.
func NewStockAlertConfig(symbol market.Symbol, conditions []AlertCondition) (StockAlertConfig, error) {
	if symbol == "" {
		return StockAlertConfig{}, market.ErrInvalidSymbol
	}
	if len(conditions) == 0 {
		return StockAlertConfig{}, shared.NewValidationError("at least one alert condition is required")
	}
	for i, cond := range conditions {
		if err := cond.Validate(); err != nil {
			return StockAlertConfig{}, shared.NewFieldValidationError(
				"conditions["+strconv.Itoa(i)+"]", err.Error(),
			)
		}
	}
	return StockAlertConfig{
		Symbol:     symbol,
		Conditions: conditions,
	}, nil
}

// Validate checks StockAlertConfig invariants.
func (a StockAlertConfig) Validate() error {
	if a.Symbol == "" {
		return market.ErrInvalidSymbol
	}
	if len(a.Conditions) == 0 {
		return shared.NewValidationError("at least one alert condition is required")
	}
	for i, cond := range a.Conditions {
		if err := cond.Validate(); err != nil {
			return shared.NewFieldValidationError(
				"conditions["+strconv.Itoa(i)+"]", err.Error(),
			)
		}
	}
	return nil
}
