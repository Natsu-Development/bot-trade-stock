package market

import (
	"errors"
	"math"
)

// Price represents a price value object
type Price struct {
	value float64
}

// NewPrice creates a new price with validation
func NewPrice(value float64) (*Price, error) {
	if value < 0 {
		return nil, errors.New("price cannot be negative")
	}

	if math.IsNaN(value) || math.IsInf(value, 0) {
		return nil, errors.New("price must be a valid number")
	}

	return &Price{value: value}, nil
}

// Value returns the price value
func (p *Price) Value() float64 {
	return p.value
}

// IsZero checks if price is zero
func (p *Price) IsZero() bool {
	return p.value == 0
}

// PercentageChange calculates percentage change from another price
func (p *Price) PercentageChange(other *Price) float64 {
	if other.IsZero() {
		return 0
	}
	return ((p.value - other.value) / other.value) * 100
}

// Equals checks if two prices are equal (with small tolerance for float comparison)
func (p *Price) Equals(other *Price) bool {
	if other == nil {
		return false
	}
	return math.Abs(p.value-other.value) < 0.0001
}
