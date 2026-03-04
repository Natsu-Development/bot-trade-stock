package trendline

import (
	"bot-trade/domain/aggregate"
	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/service/pivot"
)

const (
	defaultPivotLength   = 9   // Default pivot lookback on each side
	defaultMaxLineLength = 252 // Approx. one trading year; lines older than this are removed
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

// PricePivot is an alias for the shared PivotPoint type.
type PricePivot = pivot.PivotPoint

// Trendline represents a line connecting two pivots.
type Trendline struct {
	StartPivot PricePivot
	EndPivot   PricePivot
	Slope      float64 // Price change per bar
	Intercept  float64 // Y-intercept for linear price calculation
	Type       LineType
	IsValid    bool // True if line connects at least 2 valid pivots
	IsExtended bool // True if line is extended to current bar
}

// PriceAt calculates the trendline price at a given index using linear scale.
func (t *Trendline) PriceAt(index int) float64 {
	return t.Intercept + float64(index)*t.Slope
}

// TrendlineConfig holds configuration for trendline detection.
type TrendlineConfig struct {
	PivotLength  int // Bars to check left AND right for pivot detection
	MaxLineLength int // Maximum bars before aging out a line (default: 252)
}

// DefaultTrendlineConfig returns a configuration with defaults.
func DefaultTrendlineConfig() TrendlineConfig {
	return TrendlineConfig{
		PivotLength:  defaultPivotLength,
		MaxLineLength: defaultMaxLineLength,
	}
}

// NewTrendlineConfig creates a validated TrendlineConfig.
func NewTrendlineConfig(pivotLength int) (TrendlineConfig, error) {
	if pivotLength <= 0 {
		return TrendlineConfig{}, aggregate.NewValidationError("pivotLength must be positive")
	}

	config := DefaultTrendlineConfig()
	config.PivotLength = pivotLength

	return config, nil
}

// NewTrendlineConfigWithCustom creates a config with custom pivot length and max line length.
func NewTrendlineConfigWithCustom(pivotLength, maxLineLength int) (TrendlineConfig, error) {
	if pivotLength <= 0 {
		return TrendlineConfig{}, aggregate.NewValidationError("pivotLength must be positive")
	}
	if maxLineLength <= 0 {
		return TrendlineConfig{}, aggregate.NewValidationError("maxLineLength must be positive")
	}

	config := DefaultTrendlineConfig()
	config.PivotLength = pivotLength
	config.MaxLineLength = maxLineLength

	return config, nil
}

// BullishSignal represents a detected bullish trading signal.
type BullishSignal struct {
	Type           market.SignalType
	Price          float64
	Trendline      Trendline
	TrendlinePrice float64 // Price of the trendline at current bar
	Distance       float64 // Distance from line (%)
	Time           string
	Message        string // Human-readable description
}
