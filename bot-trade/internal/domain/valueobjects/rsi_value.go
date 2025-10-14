package valueobjects

import (
	"errors"
	"math"
)

// RSIValue represents an RSI value object with configurable thresholds
type RSIValue struct {
	value float64
}

// NewRSIValue creates a new RSI value with validation
func NewRSIValue(value float64) (*RSIValue, error) {
	if value < 0 || value > 100 {
		return nil, errors.New("RSI value must be between 0 and 100")
	}

	if math.IsNaN(value) || math.IsInf(value, 0) {
		return nil, errors.New("RSI must be a valid number")
	}

	return &RSIValue{value: value}, nil
}

// Value returns the RSI value
func (r *RSIValue) Value() float64 {
	return r.value
}

// IsOverbought checks if RSI indicates overbought condition (>= 70)
func (r *RSIValue) IsOverbought() bool {
	return r.value >= 70
}

// IsOversold checks if RSI indicates oversold condition (<= 30)
func (r *RSIValue) IsOversold() bool {
	return r.value <= 30
}

// IsExtremelyOverbought checks for extreme overbought condition (>= 80)
func (r *RSIValue) IsExtremelyOverbought() bool {
	return r.value >= 80
}

// IsExtremelyOversold checks for extreme oversold condition (<= 20)
func (r *RSIValue) IsExtremelyOversold() bool {
	return r.value <= 20
}

// IsNeutral checks if RSI is in neutral zone (30-70)
func (r *RSIValue) IsNeutral() bool {
	return r.value > 30 && r.value < 70
}

// Strength returns a description of RSI strength
func (r *RSIValue) Strength() string {
	switch {
	case r.value >= 80:
		return "extremely_overbought"
	case r.value >= 70:
		return "overbought"
	case r.value >= 60:
		return "strong"
	case r.value >= 40:
		return "neutral"
	case r.value >= 30:
		return "weak"
	case r.value >= 20:
		return "oversold"
	default:
		return "extremely_oversold"
	}
}

// Change calculates the change from another RSI value
func (r *RSIValue) Change(other *RSIValue) float64 {
	if other == nil {
		return 0
	}
	return r.value - other.value
}

// Equals checks if two RSI values are equal
func (r *RSIValue) Equals(other *RSIValue) bool {
	if other == nil {
		return false
	}
	return math.Abs(r.value-other.value) < 0.01
}
