// Package valueobject contains value objects for technical analysis.
package valueobject

// SignalType represents the type of trading signal.
type SignalType string

const (
	// Uptrend Support Breakdown Signals (price broke below support)
	BreakdownConfirmed SignalType = "breakdown_confirmed" // Broke below support
	BreakdownPotential SignalType = "breakdown_potential" // Approaching support

	// Downtrend Resistance Breakout Signals (price broke above resistance)
	BreakoutConfirmed SignalType = "breakout_confirmed" // Broke above resistance
	BreakoutPotential SignalType = "breakout_potential" // Approaching resistance
)

// IsConfirmed returns true if this is a confirmed signal.
func (st SignalType) IsConfirmed() bool {
	return st == BreakdownConfirmed || st == BreakoutConfirmed
}

// IsPotential returns true if this is a potential signal.
func (st SignalType) IsPotential() bool {
	return st == BreakdownPotential || st == BreakoutPotential
}

// Signal is a value object representing a trading signal.
// This contains signal information without presentation details.
type Signal struct {
	Type   SignalType
	Price  float64
	Time   string
	PriceLine   float64
}

// CrossingPoint represents the point where price crossed a trendline.
type CrossingPoint struct {
	Date  string
	Price float64
	Found bool
}

// NewCrossingPoint creates a new CrossingPoint value object.
func NewCrossingPoint(date string, price float64) CrossingPoint {
	return CrossingPoint{
		Date:  date,
		Price: price,
		Found: true,
	}
}

// NotFoundCrossing returns a CrossingPoint indicating no crossing was found.
func NotFoundCrossing() CrossingPoint {
	return CrossingPoint{Found: false}
}
