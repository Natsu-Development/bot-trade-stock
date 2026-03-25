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
)

var validFields = []FilterField{
	FieldRS1M, FieldRS3M, FieldRS6M, FieldRS9M, FieldRS52W,
	FieldVolumeVsSMA, FieldCurrentVolume, FieldVolumeSMA20,
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
