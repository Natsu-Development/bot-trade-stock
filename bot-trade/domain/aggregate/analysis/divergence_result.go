package analysis

import (
	"time"
)

// DivergenceResult represents the result of divergence analysis.
// This entity encapsulates whether a divergence was found and its characteristics.
type DivergenceResult struct {
	divergenceFound bool
	divergenceType  DivergenceType
	currentPrice    float64
	currentRSI      float64
	description     string
	detectedAt      time.Time
}

// NewDivergenceResult creates a new DivergenceResult with validation.
// This factory method ensures the result is in a valid initial state.
func NewDivergenceResult(
	divergenceFound bool,
	divergenceType DivergenceType,
	currentPrice float64,
	currentRSI float64,
	description string,
) *DivergenceResult {
	// Ensure consistency: if no divergence found, type should be NoDivergence
	if !divergenceFound {
		divergenceType = NoDivergence
	}

	return &DivergenceResult{
		divergenceFound: divergenceFound,
		divergenceType:  divergenceType,
		currentPrice:    currentPrice,
		currentRSI:      currentRSI,
		description:     description,
		detectedAt:      time.Now(),
	}
}

// NewNoDivergenceResult creates a result indicating no divergence was found.
// This is a convenience factory for the common case of no divergence.
func NewNoDivergenceResult(currentPrice, currentRSI float64) *DivergenceResult {
	return &DivergenceResult{
		divergenceFound: false,
		divergenceType:  NoDivergence,
		currentPrice:    currentPrice,
		currentRSI:      currentRSI,
		description:     "",
		detectedAt:      time.Now(),
	}
}

// DivergenceFound returns whether a divergence was detected.
func (dr *DivergenceResult) DivergenceFound() bool {
	return dr.divergenceFound
}

// DivergenceType returns the type of divergence detected.
func (dr *DivergenceResult) DivergenceType() DivergenceType {
	return dr.divergenceType
}

// CurrentPrice returns the current price at detection time.
func (dr *DivergenceResult) CurrentPrice() float64 {
	return dr.currentPrice
}

// CurrentRSI returns the current RSI value at detection time.
func (dr *DivergenceResult) CurrentRSI() float64 {
	return dr.currentRSI
}

// Description returns the description of the divergence.
func (dr *DivergenceResult) Description() string {
	return dr.description
}

// DetectedAt returns when the divergence was detected.
func (dr *DivergenceResult) DetectedAt() time.Time {
	return dr.detectedAt
}

// GetTypeString returns the string representation of divergence type.
func (dr *DivergenceResult) GetTypeString() string {
	return dr.divergenceType.String()
}

// IsDivergenceOfType checks if the result contains divergence of specific type.
func (dr *DivergenceResult) IsDivergenceOfType(dt DivergenceType) bool {
	return dr.divergenceFound && dr.divergenceType == dt
}

// IsActionable returns true if the divergence suggests taking action.
func (dr *DivergenceResult) IsActionable() bool {
	return dr.divergenceFound && dr.divergenceType.HasDivergence()
}
