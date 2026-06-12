// Package valueobject provides immutable value objects for the config domain.
package valueobject

import (
	"errors"
	"strconv"
	"strings"

	"backend/domain/shared"
	"backend/domain/shared/valueobject/market"
)

var (
	ErrInvalidTriggerType = errors.New("alert type must be one of: 'price_above', 'price_below', " +
		"'volume_spike', 'transaction_volume_spike', 'trendline_breakout', 'trendline_breakdown', " +
		"'price_cross_above', 'price_cross_below', 'bullish_divergence', 'bearish_divergence', " +
		"'bullish_divergence_early', 'bearish_divergence_early', " +
		"'trendline_breakout_mtf', 'trendline_breakdown_mtf'")
	ErrInvalidAlertThreshold = errors.New("alert threshold must be greater than 0")
	ErrInvalidMAReference    = errors.New("alert reference must be one of: 'ema9', 'ema21', 'ema50', 'sma200'")
)

// TriggerType identifies the kind of alert condition.
type TriggerType string

const (
	TriggerTypePriceAbove             TriggerType = "price_above"
	TriggerTypePriceBelow             TriggerType = "price_below"
	TriggerTypeVolumeSpike            TriggerType = "volume_spike"
	TriggerTypeTransactionVolumeSpike TriggerType = "transaction_volume_spike"
	TriggerTypeTrendlineBreakout      TriggerType = "trendline_breakout"
	TriggerTypeTrendlineBreakdown     TriggerType = "trendline_breakdown"
	TriggerTypePriceCrossAbove        TriggerType = "price_cross_above"
	TriggerTypePriceCrossBelow        TriggerType = "price_cross_below"
	TriggerTypeBullishDivergence      TriggerType = "bullish_divergence"
	TriggerTypeBearishDivergence      TriggerType = "bearish_divergence"
	// Early (forming/unconfirmed) divergence types. Independent of the confirmed
	// types above: each is its own per-symbol condition with its own enabled flag,
	// so firing/auto-disabling one never affects the other.
	TriggerTypeBullishDivergenceEarly TriggerType = "bullish_divergence_early"
	TriggerTypeBearishDivergenceEarly TriggerType = "bearish_divergence_early"
	// Multi-timeframe trendline types are owned by the analyze jobs (breakout/
	// breakdown), which scan all configured intervals — distinct from the
	// day-interval potential trendline tick alerts above.
	TriggerTypeBreakoutMTF  TriggerType = "trendline_breakout_mtf"
	TriggerTypeBreakdownMTF TriggerType = "trendline_breakdown_mtf"
)

// MAReference identifies which cached moving average a price-cross condition resolves against.
type MAReference string

const (
	MAReferenceEMA9   MAReference = "ema9"
	MAReferenceEMA21  MAReference = "ema21"
	MAReferenceEMA50  MAReference = "ema50"
	MAReferenceSMA200 MAReference = "sma200"
)

// Canonical display labels for each TriggerType. Single source of truth for
// notification rendering (telegram notifier reads them via configvo.Label*).
const (
	LabelPriceAbove             = "Price Above"
	LabelPriceBelow             = "Price Below"
	LabelVolumeSpike            = "Volume Spike"
	LabelMatchedVolumeBurst     = "Matched Volume Burst"
	LabelTrendlineBreakout      = "Trendline Breakout"
	LabelTrendlineBreakdown     = "Trendline Breakdown"
	LabelPriceCrossAbove        = "Price Cross Above MA"
	LabelPriceCrossBelow        = "Price Cross Below MA"
	LabelBullishDivergence      = "Bullish Divergence"
	LabelBearishDivergence      = "Bearish Divergence"
	LabelBullishDivergenceEarly = "Bullish Divergence (Early)"
	LabelBearishDivergenceEarly = "Bearish Divergence (Early)"
	LabelBreakoutMTF            = "Trendline Breakout (All Timeframes)"
	LabelBreakdownMTF           = "Trendline Breakdown (All Timeframes)"
)

// NewTriggerType creates a validated TriggerType.
func NewTriggerType(value string) (TriggerType, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	at := TriggerType(normalized)
	switch at {
	case TriggerTypePriceAbove, TriggerTypePriceBelow, TriggerTypeVolumeSpike, TriggerTypeTransactionVolumeSpike,
		TriggerTypeTrendlineBreakout, TriggerTypeTrendlineBreakdown,
		TriggerTypePriceCrossAbove, TriggerTypePriceCrossBelow,
		TriggerTypeBullishDivergence, TriggerTypeBearishDivergence,
		TriggerTypeBullishDivergenceEarly, TriggerTypeBearishDivergenceEarly,
		TriggerTypeBreakoutMTF, TriggerTypeBreakdownMTF:
		return at, nil
	default:
		return "", ErrInvalidTriggerType
	}
}

// NewMAReference creates a validated MAReference.
func NewMAReference(value string) (MAReference, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	ref := MAReference(normalized)
	switch ref {
	case MAReferenceEMA9, MAReferenceEMA21, MAReferenceEMA50, MAReferenceSMA200:
		return ref, nil
	default:
		return "", ErrInvalidMAReference
	}
}

// IsDivergence reports whether the type is one of the RSI-divergence types,
// which are evaluated by the analyze jobs (fresh history), not the tick path.
func (t TriggerType) IsDivergence() bool {
	return t == TriggerTypeBullishDivergence || t == TriggerTypeBearishDivergence ||
		t == TriggerTypeBullishDivergenceEarly || t == TriggerTypeBearishDivergenceEarly
}

// IsTrendlineMTF reports whether the type is one of the multi-timeframe trendline
// types, which the breakout/breakdown analyze jobs evaluate across all configured
// intervals — not the day-interval potential trendline tick alerts.
func (t TriggerType) IsTrendlineMTF() bool {
	return t == TriggerTypeBreakoutMTF || t == TriggerTypeBreakdownMTF
}

// IsAnalyzeOnly reports whether the type is owned exclusively by the analyze jobs
// (RSI divergence + multi-timeframe trendline). The tick alert job skips these.
func (t TriggerType) IsAnalyzeOnly() bool {
	return t.IsDivergence() || t.IsTrendlineMTF()
}

// RequiresThreshold reports whether the type needs a positive threshold
// (the 4 price/volume types). Trendline, price-cross and divergence types do not.
func (t TriggerType) RequiresThreshold() bool {
	switch t {
	case TriggerTypePriceAbove, TriggerTypePriceBelow, TriggerTypeVolumeSpike, TriggerTypeTransactionVolumeSpike:
		return true
	default:
		return false
	}
}

// RequiresReference reports whether the type needs a valid MA reference
// (the 2 price-cross types).
func (t TriggerType) RequiresReference() bool {
	return t == TriggerTypePriceCrossAbove || t == TriggerTypePriceCrossBelow
}

// TriggerCondition defines a single trigger condition for a watchlist item.
// Condition identity for dedup/scoped updates is (Type, Reference): a symbol may
// hold price_cross_above@ema9 and price_cross_above@ema50 as distinct conditions.
type TriggerCondition struct {
	Type      TriggerType `bson:"type"`
	Threshold float64     `bson:"threshold"`
	Reference string      `bson:"reference,omitempty" json:"reference,omitempty"`
	Enabled   bool        `bson:"enabled"`
}

// NewTriggerCondition creates a validated TriggerCondition.
// threshold is required (>0) only for the 4 price/volume types; reference is
// required (and validated) only for the 2 price-cross types. Both are ignored otherwise.
func NewTriggerCondition(alertType string, threshold float64, reference string, enabled bool) (TriggerCondition, error) {
	at, err := NewTriggerType(alertType)
	if err != nil {
		return TriggerCondition{}, err
	}
	cond := TriggerCondition{Type: at, Threshold: threshold, Enabled: enabled}
	if enabled && at.RequiresReference() {
		ref, err := NewMAReference(reference)
		if err != nil {
			return TriggerCondition{}, err
		}
		cond.Reference = string(ref)
	} else {
		cond.Reference = reference
	}
	// Validate is the single invariant gate: the type-parse and reference
	// normalization above produce the canonical struct, then Validate enforces
	// the rules (threshold/reference). The alert type is parsed twice by design
	// (here to normalize, in Validate to gate).
	if err := cond.Validate(); err != nil {
		return TriggerCondition{}, err
	}
	return cond, nil
}

// Validate checks TriggerCondition invariants.
// Disabled conditions are paused placeholders: they keep the user's draft value
// but do not need fire-time inputs until re-enabled. For enabled conditions,
// threshold is required only for the 4 price/volume types and reference is
// required+valid only for the 2 price-cross types. This per-type relaxation is load-bearing:
// TradingConfig.Validate runs item.Validate() on every PUT, so an unconditional
// threshold reject would make every divergence/trendline/price-cross condition unsavable.
func (c TriggerCondition) Validate() error {
	at, err := NewTriggerType(string(c.Type))
	if err != nil {
		return err
	}
	if !c.Enabled {
		return nil
	}
	if at.RequiresThreshold() && c.Threshold <= 0 {
		return ErrInvalidAlertThreshold
	}
	if at.RequiresReference() {
		if _, err := NewMAReference(c.Reference); err != nil {
			return err
		}
	}
	return nil
}

// WatchlistItem groups conditions for a single symbol on a user's config.
// A fully-disabled item (every condition.Enabled == false) is a paused state,
// not an invalid state — operators may keep watchlist items around without firing them.
type WatchlistItem struct {
	Symbol     market.Symbol      `bson:"symbol"`
	Conditions []TriggerCondition `bson:"conditions"`
}

// NewWatchlistItem creates a validated WatchlistItem.
func NewWatchlistItem(symbol market.Symbol, conditions []TriggerCondition) (WatchlistItem, error) {
	cfg := WatchlistItem{
		Symbol:     symbol,
		Conditions: conditions,
	}
	if err := cfg.Validate(); err != nil {
		return WatchlistItem{}, err
	}
	return cfg, nil
}

// Validate checks WatchlistItem invariants, including the duplicate-(Type,Reference)
// guard: two conditions sharing the same (Type, Reference) are rejected so the scoped
// arrayFilter never matches two conditions and fire-once stays correct.
func (a WatchlistItem) Validate() error {
	if a.Symbol == "" {
		return market.ErrInvalidSymbol
	}
	if len(a.Conditions) == 0 {
		return shared.NewValidationError("at least one alert condition is required")
	}
	seen := make(map[string]struct{}, len(a.Conditions))
	for i, cond := range a.Conditions {
		if err := cond.Validate(); err != nil {
			return shared.NewFieldValidationError(
				"conditions["+strconv.Itoa(i)+"]", err.Error(),
			)
		}
		key := string(cond.Type) + "\x00" + cond.Reference
		if _, dup := seen[key]; dup {
			return shared.NewFieldValidationError(
				"conditions["+strconv.Itoa(i)+"]",
				"duplicate condition for type '"+string(cond.Type)+"' and reference '"+cond.Reference+"'",
			)
		}
		seen[key] = struct{}{}
	}
	return nil
}
