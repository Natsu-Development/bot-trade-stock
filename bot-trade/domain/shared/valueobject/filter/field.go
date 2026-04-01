// Package filter provides shared immutable value objects for screener filter bounded contexts.
// This is part of the Shared Kernel pattern - explicitly shared model elements that
// all contexts agree on and use consistently.
package filter

import (
	"encoding/json"
	"errors"
	"strings"
)

var (
	// ErrInvalidFilterField is returned when filter field validation fails.
	ErrInvalidFilterField = errors.New("filter field must be a valid screener field identifier")
)

// FilterField is a value object representing a screener filter field.
// Immutable - use NewFilterField to create validated instances.
type FilterField string

// Valid screener filter fields.
const (
	FieldRS1M          FilterField = "rs_1m"
	FieldRS3M          FilterField = "rs_3m"
	FieldRS6M          FilterField = "rs_6m"
	FieldRS9M          FilterField = "rs_9m"
	FieldRS52W         FilterField = "rs_52w"
	FieldVolumeVsSMA   FilterField = "volume_vs_sma"
	FieldCurrentVolume FilterField = "current_volume"
	FieldVolumeSMA20   FilterField = "volume_sma20"

	// Price fields
	FieldCurrentPrice   FilterField = "current_price"
	FieldPriceChangePct FilterField = "price_change_pct"

	// Moving average fields
	FieldEMA9   FilterField = "ema_9"
	FieldEMA21  FilterField = "ema_21"
	FieldEMA50  FilterField = "ema_50"
	FieldSMA200 FilterField = "sma_200"

	// Signal fields (boolean)
	FieldHasBreakoutPotential  FilterField = "has_breakout_potential"
	FieldHasBreakoutConfirmed  FilterField = "has_breakout_confirmed"
	FieldHasBreakdownPotential FilterField = "has_breakdown_potential"
	FieldHasBreakdownConfirmed FilterField = "has_breakdown_confirmed"
	FieldHasBullishRSI         FilterField = "has_bullish_rsi"
	FieldHasBearishRSI         FilterField = "has_bearish_rsi"
)

var validFields = []FilterField{
	FieldRS1M, FieldRS3M, FieldRS6M, FieldRS9M, FieldRS52W,
	FieldVolumeVsSMA, FieldCurrentVolume, FieldVolumeSMA20,
	FieldCurrentPrice, FieldPriceChangePct,
	FieldEMA9, FieldEMA21, FieldEMA50, FieldSMA200,
	FieldHasBreakoutPotential, FieldHasBreakoutConfirmed,
	FieldHasBreakdownPotential, FieldHasBreakdownConfirmed,
	FieldHasBullishRSI, FieldHasBearishRSI,
}

func isValidFilterField(f FilterField) bool {
	for _, valid := range validFields {
		if valid == f {
			return true
		}
	}
	return false
}

// NewFilterField creates a validated FilterField.
func NewFilterField(value string) (FilterField, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	field := FilterField(normalized)

	if !isValidFilterField(field) {
		return "", ErrInvalidFilterField
	}

	return field, nil
}

// ValidFilterFields returns all valid filter field names as strings.
func ValidFilterFields() []string {
	result := make([]string, len(validFields))
	for i, f := range validFields {
		result[i] = string(f)
	}
	return result
}

// String returns the string representation of the field.
func (f FilterField) String() string {
	return string(f)
}

// IsMovingAverage returns true if the field is a moving average type.
func (f FilterField) IsMovingAverage() bool {
	return f == FieldEMA9 || f == FieldEMA21 || f == FieldEMA50 || f == FieldSMA200
}

// IsSignal returns true if the field is a signal type (boolean).
func (f FilterField) IsSignal() bool {
	return f == FieldHasBreakoutPotential || f == FieldHasBreakoutConfirmed ||
		f == FieldHasBreakdownPotential || f == FieldHasBreakdownConfirmed ||
		f == FieldHasBullishRSI || f == FieldHasBearishRSI
}

// MarshalJSON implements json.Marshaler for FilterField.
func (f FilterField) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(f))
}

// UnmarshalJSON implements json.Unmarshaler for FilterField with validation.
func (f *FilterField) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	field, err := NewFilterField(s)
	if err != nil {
		return err
	}
	*f = field
	return nil
}
