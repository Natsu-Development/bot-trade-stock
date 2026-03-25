// Package valueobject contains value objects for technical analysis.
package valueobject

import (
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// DivergenceType represents the type of divergence.
type DivergenceType string

const (
	BullishDivergence DivergenceType = "bullish"
	BearishDivergence DivergenceType = "bearish"
)

// IsBullish returns true if this is a bullish divergence.
func (dt DivergenceType) IsBullish() bool {
	return dt == BullishDivergence
}

// IsBearish returns true if this is a bearish divergence.
func (dt DivergenceType) IsBearish() bool {
	return dt == BearishDivergence
}

// Divergence is a value object representing a detected divergence pattern.
// It contains two pivots showing the divergence between price and RSI.
// IsEarly indicates whether the divergence is forming (true) or confirmed (false).
type Divergence struct {
	Type        DivergenceType
	FirstPivot  marketvo.MarketData // Older pivot (FROM)
	SecondPivot marketvo.MarketData // Newer pivot (TO) - confirmed pivot OR current bar for early
	IsEarly     bool                // true = early detection, false = confirmed divergence
}
