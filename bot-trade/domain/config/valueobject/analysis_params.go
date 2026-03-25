// Package valueobject provides immutable value objects for the config domain.
package valueobject

import "bot-trade/domain/shared"

// Divergence holds divergence detection parameters.
type Divergence struct {
	RangeMin int `bson:"range_min"`
	RangeMax int `bson:"range_max"`
}

// Validate checks divergence invariants.
func (d *Divergence) Validate() error {
	if d.RangeMin <= 0 {
		return shared.NewValidationError("divergence.range_min must be a positive integer")
	}
	if d.RangeMax <= 0 {
		return shared.NewValidationError("divergence.range_max must be a positive integer")
	}
	if d.RangeMin > d.RangeMax {
		return shared.NewValidationError("divergence.range_min must be less than or equal to range_max")
	}
	return nil
}

// Trendline holds configuration for trendline building and signal generation.
type Trendline struct {
	MaxLines         int     `bson:"max_lines"`                 // Maximum number of lines to keep per direction
	ProximityPercent float64 `bson:"proximity_percent"` // Percentage distance from price to trendline for signal generation
}

// Validate checks trendline invariants.
func (t *Trendline) Validate() error {
	if t.MaxLines <= 0 {
		return shared.NewValidationError("trendline.max_lines must be a positive integer")
	}
	if t.ProximityPercent <= 0 {
		return shared.NewValidationError("trendline.proximity_percent must be a positive number")
	}
	return nil
}
