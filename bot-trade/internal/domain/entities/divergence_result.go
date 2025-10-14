package entities

import (
	"time"

	"bot-trade/internal/domain/valueobjects"
)

// DivergenceResult represents the result of divergence analysis
type DivergenceResult struct {
	DivergenceFound bool
	DivergenceType  valueobjects.DivergenceType
	CurrentPrice    float64
	CurrentRSI      float64
	Description     string
}

// GetTradingSignal generates appropriate trading signal based on divergence type
func (dr *DivergenceResult) GetTradingSignal() valueobjects.TradingSignal {
	if !dr.DivergenceFound {
		return valueobjects.Hold
	}

	if dr.DivergenceType.IsBullish() {
		return valueobjects.Buy
	}

	if dr.DivergenceType.IsBearish() {
		return valueobjects.Sell
	}

	return valueobjects.Hold
}

// GetTypeString returns the string representation of divergence type
func (dr *DivergenceResult) GetTypeString() string {
	return dr.DivergenceType.String()
}

// IsDivergenceOfType checks if the result contains divergence of specific type
func (dr *DivergenceResult) IsDivergenceOfType(dt valueobjects.DivergenceType) bool {
	return dr.DivergenceFound && dr.DivergenceType == dt
}

// IsActionable returns true if the divergence suggests taking action
func (dr *DivergenceResult) IsActionable() bool {
	return dr.DivergenceFound && dr.DivergenceType.HasDivergence()
}

// GetDetectionTime returns current time for when divergence was detected
func (dr *DivergenceResult) GetDetectionTime() time.Time {
	return time.Now()
}
