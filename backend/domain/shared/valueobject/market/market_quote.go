// Package market provides market-related value objects shared across all bounded contexts.
package market

// MarketQuote represents a real-time market quote for a single symbol.
// Provider-agnostic — any infrastructure adapter (SSI, VPS, etc.) can produce it.
// This is a value object — immutable data record shared across all bounded contexts.
type MarketQuote struct {
	Symbol           string
	MatchedPrice     float64
	TotalTradedQty   int64
	TotalTradedValue float64
	PriceChange      float64
	PriceChangePct   float64
	RefPrice         float64
	Ceiling          float64
	Floor            float64
	Highest          float64
	Lowest           float64
	AvgPrice         float64

	// Order book level 1
	Best1Bid      float64
	Best1BidVol   int64
	Best1Offer    float64
	Best1OfferVol int64

	// Order book level 2
	Best2Bid      float64
	Best2BidVol   int64
	Best2Offer    float64
	Best2OfferVol int64

	// Order book level 3
	Best3Bid      float64
	Best3BidVol   int64
	Best3Offer    float64
	Best3OfferVol int64

	TradingDate string
	Exchange    string
}

// Direction is the inferred side of a matched trade, based on price vs the
// L1 order book at snapshot time. The underlying type is string so `%s` in
// fmt formats it natively — no explicit String() method needed.
type Direction string

const (
	DirectionBuy     Direction = "BUY"
	DirectionSell    Direction = "SELL"
	DirectionNeutral Direction = "NEUTRAL"
)

// ClassifyDirection infers the trade direction from MatchedPrice vs the L1
// bid/offer. Returns DirectionNeutral when neither side can be confidently
// labeled (mid-spread match, locked market, or stale order book).
func (q MarketQuote) ClassifyDirection() Direction {
	switch {
	case q.Best1Offer > 0 && q.MatchedPrice >= q.Best1Offer:
		return DirectionBuy
	case q.Best1Bid > 0 && q.MatchedPrice <= q.Best1Bid:
		return DirectionSell
	default:
		return DirectionNeutral
	}
}

// MatchedVolumeDelta returns the shares matched between prev and q.
// valid=false signals one of:
//   - cold start (prev is zero-valued — TradingDate empty)
//   - day rollover (q.TotalTradedQty < prev.TotalTradedQty; SSI resets
//     nmTotalTradedQty at market open)
//
// Callers MUST treat valid=false as "no signal" — neither fire an alert
// nor compute downstream metrics from delta.
func (q MarketQuote) MatchedVolumeDelta(prev MarketQuote) (delta int64, valid bool) {
	if prev.TradingDate == "" {
		return 0, false
	}
	if q.TotalTradedQty < prev.TotalTradedQty {
		return 0, false
	}
	return q.TotalTradedQty - prev.TotalTradedQty, true
}
