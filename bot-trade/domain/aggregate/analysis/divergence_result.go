package analysis

import (
	"time"
)

// DivergenceResult represents the result of divergence analysis.
// This is a child entity of AnalysisResult aggregate.
type DivergenceResult struct {
	divergenceFound bool
	divergenceType  DivergenceType
	currentPrice    float64
	currentRSI      float64
	description     string
	detectedAt      time.Time
}

// NewDivergenceResult creates a new DivergenceResult.
func NewDivergenceResult(
	divergenceFound bool,
	divergenceType DivergenceType,
	currentPrice float64,
	currentRSI float64,
	description string,
) *DivergenceResult {
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
