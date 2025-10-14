package config

import "fmt"

// DivergenceConfig holds the lookback parameters for divergence detection
// This is application/infrastructure configuration, not a domain value object
type DivergenceConfig struct {
	LookbackLeft  int // Bars to check left of pivot
	LookbackRight int // Bars to check right of pivot
	RangeMin      int // Minimum bars between divergence points
	RangeMax      int // Maximum bars between divergence points
}

// NewDivergenceConfig creates configuration with validation from main config
func NewDivergenceConfig(cfg *Config) (*DivergenceConfig, error) {
	divConfig := &DivergenceConfig{
		LookbackLeft:  cfg.DivergenceLookbackLeft,
		LookbackRight: cfg.DivergenceLookbackRight,
		RangeMin:      cfg.DivergenceRangeMin,
		RangeMax:      cfg.DivergenceRangeMax,
	}

	if err := divConfig.Validate(); err != nil {
		return nil, err
	}

	return divConfig, nil
}

// Validate validates divergence configuration parameters
func (d *DivergenceConfig) Validate() error {
	if d.LookbackLeft < 1 || d.LookbackLeft > 20 {
		return fmt.Errorf("lookback left must be between 1 and 20, got %d", d.LookbackLeft)
	}

	if d.LookbackRight < 1 || d.LookbackRight > 20 {
		return fmt.Errorf("lookback right must be between 1 and 20, got %d", d.LookbackRight)
	}

	if d.RangeMin < 1 {
		return fmt.Errorf("range min must be at least 1, got %d", d.RangeMin)
	}

	if d.RangeMax < 5 || d.RangeMax > 200 {
		return fmt.Errorf("range max must be between 5 and 200, got %d", d.RangeMax)
	}

	if d.RangeMin >= d.RangeMax {
		return fmt.Errorf("range min (%d) must be less than range max (%d)", d.RangeMin, d.RangeMax)
	}

	return nil
}

// IsValidDataLength checks if there's enough data for pivot detection
func (d *DivergenceConfig) IsValidDataLength(dataPoints int) bool {
	return dataPoints >= d.LookbackLeft+d.LookbackRight+1
}

// IsValidPivotRange checks if pivot distance is within acceptable range
func (d *DivergenceConfig) IsValidPivotRange(barsBetween int) bool {
	return barsBetween >= d.RangeMin && barsBetween <= d.RangeMax
}
