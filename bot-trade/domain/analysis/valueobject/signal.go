// Package valueobject contains value objects for technical analysis.
package valueobject

// SignalType represents the type of trading signal.
type SignalType string

const (
	// Uptrend Support Bounce Signals
	BounceConfirmed SignalType = "bounce_confirmed" // Bounced off support
	BouncePotential SignalType = "bounce_potential" // Approaching support

	// Downtrend Resistance Breakout Signals
	BreakoutConfirmed SignalType = "breakout_confirmed" // Broke above resistance
	BreakoutPotential SignalType = "breakout_potential" // Approaching resistance
)

// IsConfirmed returns true if this is a confirmed signal.
func (st SignalType) IsConfirmed() bool {
	return st == BounceConfirmed || st == BreakoutConfirmed
}

// IsPotential returns true if this is a potential signal.
func (st SignalType) IsPotential() bool {
	return st == BouncePotential || st == BreakoutPotential
}

// Signal is a value object representing a trading signal.
// This contains signal information without presentation details.
type Signal struct {
	Type      SignalType
	Price     float64
	Time      string
	Trendline *Trendline
	Source    string
}
