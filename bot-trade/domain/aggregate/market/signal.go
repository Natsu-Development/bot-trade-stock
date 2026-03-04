package market

import (
	"time"
)

// SignalType represents the type of trading signal.
type SignalType string

const (
	// Uptrend Support Bounce Signals
	BounceConfirmed SignalType = "bounce_confirmed" // Bounced off support
	BouncePotential SignalType = "bounce_potential" // Approaching support
	BounceWatching  SignalType = "bounce_watching"  // Near support

	// Downtrend Resistance Breakout Signals
	BreakoutConfirmed SignalType = "breakout_confirmed" // Broke above resistance
	BreakoutPotential SignalType = "breakout_potential" // Approaching resistance
	BreakoutWatching  SignalType = "breakout_watching"  // Near resistance

	// No signal detected
	NoSignalType SignalType = "no_signal"
)

// SignalLevel represents the confidence level of a signal.
type SignalLevel int

const (
	NoSignalLevel  SignalLevel = iota
	WatchingLevel              // Price near line, monitoring
	PotentialLevel             // Price approaching with supporting indicators
	ConfirmedLevel             // Signal confirmed with all criteria met
)

// String returns the string representation of SignalLevel.
func (sl SignalLevel) String() string {
	switch sl {
	case ConfirmedLevel:
		return "confirmed"
	case PotentialLevel:
		return "potential"
	case WatchingLevel:
		return "watching"
	default:
		return "none"
	}
}

// TrendlineInfo contains information about a trendline.
type TrendlineInfo struct {
	Type             string  // "uptrend_support" or "downtrend_resistance"
	StartPrice       float64 // Price at start pivot
	EndPrice         float64 // Price at end pivot
	StartDate        string
	EndDate          string
	CurrentLinePrice float64 // Extended price at current bar
	Slope            float64 // Price change per bar
}

// TrendlineDataPoint represents a single point on a trendline at a specific date.
type TrendlineDataPoint struct {
	Date  string
	Price float64
}

// TrendlineDisplay contains all data needed to display a trendline on the frontend.
// It includes pre-calculated data points for each trading date, so the frontend
// doesn't need to perform any slope calculations.
//
// Per Pine Script behavior: trendlines stop at the first cross (break) event.
// They do not extend beyond where price has crossed the line.
type TrendlineDisplay struct {
	Type       string                // "uptrend_support" or "downtrend_resistance"
	DataPoints []TrendlineDataPoint  // Pre-calculated points for each trading date
	StartPrice float64
	EndPrice   float64
	StartDate  string
	EndDate    string
	Slope      float64 // Still include for reference/debugging
	BrokenAt   *string // Optional: date where trendline was broken (crossed), if any
	BrokenType *string // Optional: "cross_below" for support break, "cross_above" for resistance breakout
}

// TradingSignal is the aggregate root for trading signals.
// It represents a unified signal that can come from various sources
// (divergence, trendline, breakout, etc.).
type TradingSignal struct {
	ID          string
	Symbol      string
	Type        SignalType
	SignalLevel SignalLevel
	Price       float64
	Confidence  float64 // 0-1
	Target      float64 // Suggested target price
	StopLoss    float64 // Suggested stop loss
	Timestamp   time.Time
	Time        string // Bar time for the signal

	// Trendline-specific fields (optional)
	Trendline *TrendlineInfo

	// Analysis details
	Message string // Human-readable description
	Source  string // "divergence", "trendline", "breakout", etc.

	// Metadata
	Interval   string
	RSIPeriod  int
	CurrentRSI float64
}

// NewTradingSignal creates a new TradingSignal.
func NewTradingSignal(
	symbol string,
	signalType SignalType,
	price float64,
	confidence float64,
	message string,
	source string,
) *TradingSignal {
	return &TradingSignal{
		Symbol:     symbol,
		Type:       signalType,
		Price:      price,
		Confidence: confidence,
		Message:    message,
		Source:     source,
		Timestamp:  time.Now(),
	}
}

// IsConfirmed returns true if the signal is at confirmed level.
func (s *TradingSignal) IsConfirmed() bool {
	return s.SignalLevel == ConfirmedLevel
}

// IsPotential returns true if the signal is at potential level.
func (s *TradingSignal) IsPotential() bool {
	return s.SignalLevel == PotentialLevel
}

// IsWatching returns true if the signal is at watching level.
func (s *TradingSignal) IsWatching() bool {
	return s.SignalLevel == WatchingLevel
}
