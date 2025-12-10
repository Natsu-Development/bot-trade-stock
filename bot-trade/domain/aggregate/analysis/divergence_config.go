package analysis

import (
	"errors"
	"fmt"
)

// DivergenceConfig is an immutable value object for divergence detection configuration.
// It encapsulates lookback periods and range settings used by pivot detection algorithms.
type DivergenceConfig struct {
	lookbackLeft  int
	lookbackRight int
	rangeMin      int
	rangeMax      int
}

// NewDivergenceConfig creates a validated DivergenceConfig.
// All values must be positive, and rangeMin must be less than or equal to rangeMax.
func NewDivergenceConfig(lookbackLeft, lookbackRight, rangeMin, rangeMax int) (DivergenceConfig, error) {
	if lookbackLeft <= 0 {
		return DivergenceConfig{}, errors.New("lookbackLeft must be positive")
	}
	if lookbackRight <= 0 {
		return DivergenceConfig{}, errors.New("lookbackRight must be positive")
	}
	if rangeMin <= 0 {
		return DivergenceConfig{}, errors.New("rangeMin must be positive")
	}
	if rangeMax <= 0 {
		return DivergenceConfig{}, errors.New("rangeMax must be positive")
	}
	if rangeMin > rangeMax {
		return DivergenceConfig{}, fmt.Errorf("rangeMin (%d) cannot be greater than rangeMax (%d)", rangeMin, rangeMax)
	}

	return DivergenceConfig{
		lookbackLeft:  lookbackLeft,
		lookbackRight: lookbackRight,
		rangeMin:      rangeMin,
		rangeMax:      rangeMax,
	}, nil
}

// LookbackLeft returns the left lookback period for pivot detection.
func (c DivergenceConfig) LookbackLeft() int {
	return c.lookbackLeft
}

// LookbackRight returns the right lookback period for pivot detection.
func (c DivergenceConfig) LookbackRight() int {
	return c.lookbackRight
}

// RangeMin returns the minimum range between pivots for divergence detection.
func (c DivergenceConfig) RangeMin() int {
	return c.rangeMin
}

// RangeMax returns the maximum range between pivots for divergence detection.
func (c DivergenceConfig) RangeMax() int {
	return c.rangeMax
}

// MinDataPoints returns the minimum number of data points required for analysis.
func (c DivergenceConfig) MinDataPoints() int {
	return c.lookbackLeft + c.lookbackRight + 1
}

// Equals checks if two DivergenceConfig values are equal.
func (c DivergenceConfig) Equals(other DivergenceConfig) bool {
	return c.lookbackLeft == other.lookbackLeft &&
		c.lookbackRight == other.lookbackRight &&
		c.rangeMin == other.rangeMin &&
		c.rangeMax == other.rangeMax
}

// String returns a string representation of the configuration.
func (c DivergenceConfig) String() string {
	return fmt.Sprintf("DivergenceConfig{lookbackLeft: %d, lookbackRight: %d, rangeMin: %d, rangeMax: %d}",
		c.lookbackLeft, c.lookbackRight, c.rangeMin, c.rangeMax)
}
