package trendline

import "math"

// SignalType represents the type of bullish trading signal detected.
type SignalType string

const (
	BounceConfirmed   SignalType = "bounce_confirmed"   // Bounced off uptrend support
	BouncePotential   SignalType = "bounce_potential"   // Approaching uptrend support
	BounceWatching    SignalType = "bounce_watching"    // Near uptrend support
	BreakoutConfirmed SignalType = "breakout_confirmed" // Broke above downtrend resistance
	BreakoutPotential SignalType = "breakout_potential" // Approaching downtrend resistance
	BreakoutWatching  SignalType = "breakout_watching"  // Near downtrend resistance
	NoSignal          SignalType = "no_signal"
)

// LineType represents whether a trendline is support or resistance.
type LineType int

const (
	UptrendSupport      LineType = iota // Connects pivot lows, acts as support/floor
	DowntrendResistance                 // Connects pivot highs, acts as resistance/ceiling
)

// String returns the string representation of LineType.
func (lt LineType) String() string {
	switch lt {
	case UptrendSupport:
		return "uptrend_support"
	case DowntrendResistance:
		return "downtrend_resistance"
	default:
		return "unknown"
	}
}

// PricePivot represents a pivot point based on price (not RSI).
// Used for trendline construction.
type PricePivot struct {
	Index int
	High  float64
	Low   float64
	Close float64
	Date  string
}

// Trendline represents a line connecting two or more pivots.
type Trendline struct {
	StartPivot   PricePivot
	EndPivot     PricePivot
	Slope        float64 // Price change per bar
	Intercept    float64 // Y-intercept for price calculation
	InterceptLog float64 // Y-intercept for log scale calculation
	Type         LineType
	IsValid      bool // True if line connects at least 2 valid pivots
	IsExtended   bool // True if line is extended to current bar
	UseLogScale  bool // True if this trendline uses log scale calculation
	// Cross tracking fields
	Crosses []CrossEvent // Historical cross events for this trendline
}

// CrossEvent represents a price cross event at a specific point in time.
type CrossEvent struct {
	Index     int     // Bar index where cross occurred
	Date      string  // Date of cross
	Price     float64 // Price at cross
	CrossType string  // "cross_above" for resistance breakout, "cross_below" for support break
}

// PriceAt calculates the trendline price at a given index.
func (t *Trendline) PriceAt(index int) float64 {
	return t.Intercept + float64(index)*t.Slope
}

// PriceAtLog calculates the trendline price at a given index using log scale.
func (t *Trendline) PriceAtLog(index int) float64 {
	return math.Exp(t.InterceptLog - t.Slope*float64(t.EndPivot.Index-index))
}

// TrendlineConfig holds configuration for trendline detection.
type TrendlineConfig struct {
	// Pivot detection settings
	PivotLength int // Bars to check left AND right for pivot detection (Pine Script style)

	// Trendline formation settings
	MaxLineLength int // Maximum bars before aging out a line (default: 252)

	// Scale settings
	UseLogScale bool // Use log scale for slope calculation
}

// DefaultTrendlineConfig returns a configuration with Pine Script defaults.
func DefaultTrendlineConfig() TrendlineConfig {
	return TrendlineConfig{
		PivotLength:   9,   // Pine Script default
		MaxLineLength: 252, // Pine Script default
		UseLogScale:   false, // Use linear scale to match frontend chart scale
	}
}

// NewTrendlineConfig creates a validated TrendlineConfig (Pine Script style).
func NewTrendlineConfig(pivotLength int) (TrendlineConfig, error) {
	if pivotLength <= 0 {
		return TrendlineConfig{}, divErr("pivotLength must be positive")
	}

	config := DefaultTrendlineConfig()
	config.PivotLength = pivotLength

	return config, nil
}

// NewTrendlineConfigWithCustom creates a config with custom pivot length and max line length.
func NewTrendlineConfigWithCustom(pivotLength, maxLineLength int) (TrendlineConfig, error) {
	if pivotLength <= 0 {
		return TrendlineConfig{}, divErr("pivotLength must be positive")
	}
	if maxLineLength <= 0 {
		return TrendlineConfig{}, divErr("maxLineLength must be positive")
	}

	config := DefaultTrendlineConfig()
	config.PivotLength = pivotLength
	config.MaxLineLength = maxLineLength

	return config, nil
}

// BullishSignal represents a detected bullish trading signal.
type BullishSignal struct {
	Type           SignalType
	Price          float64
	Trendline      Trendline
	TrendlinePrice float64 // Price of the trendline at current bar
	Distance       float64 // Distance from line (%)
	Time           string
	Message        string // Human-readable description
}

// divErr creates an error for validation failures.
func divErr(msg string) error {
	return &divError{msg: msg}
}

type divError struct {
	msg string
}

func (e *divError) Error() string {
	return e.msg
}
