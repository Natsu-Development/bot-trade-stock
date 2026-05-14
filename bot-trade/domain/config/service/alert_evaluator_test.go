package service

import (
	"strings"
	"testing"

	configvo "bot-trade/domain/config/valueobject"
	metricsagg "bot-trade/domain/metrics/aggregate"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

func TestEvaluate_PriceAbove(t *testing.T) {
	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{Type: configvo.AlertTypePriceAbove, Threshold: 100, Enabled: true}

	// Fires when strictly greater.
	got, fired := e.Evaluate(cond, marketvo.MarketQuote{MatchedPrice: 101}, marketvo.MarketQuote{}, nil)
	if !fired || got.Label != configvo.LabelPriceAbove {
		t.Errorf("expected fire with label %q, got fired=%v label=%q", configvo.LabelPriceAbove, fired, got.Label)
	}

	// Equal does NOT fire (> not >=).
	if _, fired := e.Evaluate(cond, marketvo.MarketQuote{MatchedPrice: 100}, marketvo.MarketQuote{}, nil); fired {
		t.Error("price equal threshold should not fire price_above")
	}

	// Less does NOT fire.
	if _, fired := e.Evaluate(cond, marketvo.MarketQuote{MatchedPrice: 99}, marketvo.MarketQuote{}, nil); fired {
		t.Error("price below threshold should not fire price_above")
	}
}

func TestEvaluate_PriceBelow(t *testing.T) {
	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{Type: configvo.AlertTypePriceBelow, Threshold: 100, Enabled: true}

	got, fired := e.Evaluate(cond, marketvo.MarketQuote{MatchedPrice: 99}, marketvo.MarketQuote{}, nil)
	if !fired || got.Label != configvo.LabelPriceBelow {
		t.Errorf("expected fire with label %q, got fired=%v label=%q", configvo.LabelPriceBelow, fired, got.Label)
	}

	if _, fired := e.Evaluate(cond, marketvo.MarketQuote{MatchedPrice: 100}, marketvo.MarketQuote{}, nil); fired {
		t.Error("equal threshold should not fire price_below")
	}
}

func TestEvaluate_VolumeSpike(t *testing.T) {
	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{Type: configvo.AlertTypeVolumeSpike, Threshold: 200, Enabled: true}

	// Fires at 200% (2x SMA).
	got, fired := e.Evaluate(
		cond,
		marketvo.MarketQuote{TotalTradedQty: 2000},
		marketvo.MarketQuote{},
		&metricsagg.StockMetrics{VolumeSMA20: 1000},
	)
	if !fired || got.Label != configvo.LabelVolumeSpike {
		t.Errorf("expected fire with label %q, got fired=%v label=%q", configvo.LabelVolumeSpike, fired, got.Label)
	}

	// Sub-threshold ratio does not fire.
	if _, fired := e.Evaluate(
		cond,
		marketvo.MarketQuote{TotalTradedQty: 1500},
		marketvo.MarketQuote{},
		&metricsagg.StockMetrics{VolumeSMA20: 1000},
	); fired {
		t.Error("150% should not fire ≥200% threshold")
	}

	// Nil metrics → no fire.
	if _, fired := e.Evaluate(cond, marketvo.MarketQuote{TotalTradedQty: 9999}, marketvo.MarketQuote{}, nil); fired {
		t.Error("nil metrics should not fire volume_spike")
	}

	// Zero SMA20 → no fire.
	if _, fired := e.Evaluate(
		cond,
		marketvo.MarketQuote{TotalTradedQty: 9999},
		marketvo.MarketQuote{},
		&metricsagg.StockMetrics{VolumeSMA20: 0},
	); fired {
		t.Error("zero SMA20 should not fire volume_spike")
	}
}

func TestEvaluate_TransactionVolumeSpike_ColdStart(t *testing.T) {
	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{Type: configvo.AlertTypeTransactionVolumeSpike, Threshold: 50_000, Enabled: true}

	// Prev with empty TradingDate is the cold-start sentinel.
	_, fired := e.Evaluate(
		cond,
		marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 1_000_000},
		marketvo.MarketQuote{},
		nil,
	)
	if fired {
		t.Error("cold-start should not fire transaction_volume_spike")
	}
}

func TestEvaluate_TransactionVolumeSpike_BuyFires(t *testing.T) {
	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{Type: configvo.AlertTypeTransactionVolumeSpike, Threshold: 50_000, Enabled: true}

	prev := marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 1_000_000}
	curr := marketvo.MarketQuote{
		TradingDate:    "2026-05-12",
		TotalTradedQty: 1_075_000,
		MatchedPrice:   25.55,
		Best1Bid:       25.50, Best1BidVol: 100,
		Best1Offer: 25.55, Best1OfferVol: 200,
		Best2BidVol:   50,
		Best3BidVol:   25,
		Best2OfferVol: 75,
		Best3OfferVol: 50,
	}

	got, fired := e.Evaluate(cond, curr, prev, nil)
	if !fired {
		t.Fatal("expected fire for BUY delta=75_000 ≥ 50_000")
	}
	if got.Label != configvo.LabelMatchedVolumeBurst {
		t.Errorf("label = %q, want %q", got.Label, configvo.LabelMatchedVolumeBurst)
	}
	if !strings.Contains(got.Value, "BUY") {
		t.Errorf("expected BUY in value, got %q", got.Value)
	}
	// Bid depth = 100+50+25 = 175; Ask depth = 200+75+50 = 325
	if !strings.Contains(got.Value, "bid 175") || !strings.Contains(got.Value, "ask 325") {
		t.Errorf("expected cumulative book depths in value, got %q", got.Value)
	}
}

func TestEvaluate_TransactionVolumeSpike_NeutralNoFire(t *testing.T) {
	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{Type: configvo.AlertTypeTransactionVolumeSpike, Threshold: 50_000, Enabled: true}

	prev := marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 1_000_000}
	// Matched mid-spread → NEUTRAL classifier → no fire even with valid delta.
	curr := marketvo.MarketQuote{
		TradingDate:    "2026-05-12",
		TotalTradedQty: 1_075_000,
		MatchedPrice:   25.52,
		Best1Bid:       25.50, Best1Offer: 25.55,
	}
	if _, fired := e.Evaluate(cond, curr, prev, nil); fired {
		t.Error("NEUTRAL direction should not fire transaction_volume_spike")
	}
}

func TestEvaluate_TransactionVolumeSpike_SubThresholdNoFire(t *testing.T) {
	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{Type: configvo.AlertTypeTransactionVolumeSpike, Threshold: 50_000, Enabled: true}

	prev := marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 1_000_000}
	curr := marketvo.MarketQuote{
		TradingDate:    "2026-05-12",
		TotalTradedQty: 1_005_000, // delta = 5,000 < 50,000
		MatchedPrice:   25.55,
		Best1Bid:       25.50, Best1Offer: 25.55,
	}
	if _, fired := e.Evaluate(cond, curr, prev, nil); fired {
		t.Error("sub-threshold delta should not fire")
	}
}

func TestEvaluate_TransactionVolumeSpike_DayRolloverNoFire(t *testing.T) {
	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{Type: configvo.AlertTypeTransactionVolumeSpike, Threshold: 50_000, Enabled: true}

	prev := marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 5_000_000}
	curr := marketvo.MarketQuote{
		TradingDate:    "2026-05-13",
		TotalTradedQty: 12_000, // SSI counter reset at market open
		MatchedPrice:   25.55,
		Best1Bid:       25.50, Best1Offer: 25.55,
	}
	if _, fired := e.Evaluate(cond, curr, prev, nil); fired {
		t.Error("day rollover should not fire (silent reseed)")
	}
}

// TestEvaluate_TransactionVolumeSpike_BuySellDirections drives the matched-volume-burst
// rule across BUY/SELL/NEUTRAL classification paths using explicit prev/current quote
// mocks. Each case names exactly one expected direction so a regression in either side
// fails its own subtest.
func TestEvaluate_TransactionVolumeSpike_BuySellDirections(t *testing.T) {
	const threshold float64 = 50_000

	type wantOut struct {
		fired     bool
		direction string // "" when not fired
		delta     int64  // expected reported delta when fired
	}

	tests := []struct {
		name string
		prev marketvo.MarketQuote
		curr marketvo.MarketQuote
		want wantOut
	}{
		{
			name: "BUY: matched exactly at offer with above-threshold delta",
			prev: marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 1_000_000},
			curr: marketvo.MarketQuote{
				TradingDate:    "2026-05-12",
				TotalTradedQty: 1_080_000, // delta = 80_000
				MatchedPrice:   25.55,
				Best1Bid:       25.50, Best1BidVol: 1000,
				Best1Offer: 25.55, Best1OfferVol: 800,
				Best2BidVol: 500, Best3BidVol: 100,
				Best2OfferVol: 400, Best3OfferVol: 200,
			},
			want: wantOut{fired: true, direction: "BUY", delta: 80_000},
		},
		{
			name: "BUY: matched above offer (lifted) with delta ≥ threshold",
			prev: marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 2_000_000},
			curr: marketvo.MarketQuote{
				TradingDate:    "2026-05-12",
				TotalTradedQty: 2_055_000, // delta = 55_000
				MatchedPrice:   25.60,     // > Best1Offer 25.55
				Best1Bid:       25.50, Best1Offer: 25.55,
			},
			want: wantOut{fired: true, direction: "BUY", delta: 55_000},
		},
		{
			name: "SELL: matched exactly at bid with above-threshold delta",
			prev: marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 3_000_000},
			curr: marketvo.MarketQuote{
				TradingDate:    "2026-05-12",
				TotalTradedQty: 3_120_000, // delta = 120_000
				MatchedPrice:   25.50,
				Best1Bid:       25.50, Best1BidVol: 600,
				Best1Offer: 25.55, Best1OfferVol: 900,
				Best2BidVol: 300, Best3BidVol: 150,
				Best2OfferVol: 200, Best3OfferVol: 100,
			},
			want: wantOut{fired: true, direction: "SELL", delta: 120_000},
		},
		{
			name: "SELL: matched below bid (hit) with delta ≥ threshold",
			prev: marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 4_000_000},
			curr: marketvo.MarketQuote{
				TradingDate:    "2026-05-12",
				TotalTradedQty: 4_060_000, // delta = 60_000
				MatchedPrice:   25.45,     // < Best1Bid 25.50
				Best1Bid:       25.50, Best1Offer: 25.55,
			},
			want: wantOut{fired: true, direction: "SELL", delta: 60_000},
		},
		{
			name: "NEUTRAL: matched mid-spread does not fire even with above-threshold delta",
			prev: marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 1_000_000},
			curr: marketvo.MarketQuote{
				TradingDate:    "2026-05-12",
				TotalTradedQty: 1_200_000, // delta = 200_000
				MatchedPrice:   25.52,     // strictly inside the spread
				Best1Bid:       25.50, Best1Offer: 25.55,
			},
			want: wantOut{fired: false},
		},
		{
			name: "NEUTRAL: empty order book never classifies even when matched price is non-zero",
			prev: marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 1_000_000},
			curr: marketvo.MarketQuote{
				TradingDate:    "2026-05-12",
				TotalTradedQty: 1_080_000,
				MatchedPrice:   25.55,
				Best1Bid:       0, Best1Offer: 0,
			},
			want: wantOut{fired: false},
		},
		{
			name: "BUY direction but sub-threshold delta does not fire",
			prev: marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 1_000_000},
			curr: marketvo.MarketQuote{
				TradingDate:    "2026-05-12",
				TotalTradedQty: 1_010_000, // delta = 10_000 < 50_000
				MatchedPrice:   25.55,
				Best1Bid:       25.50, Best1Offer: 25.55,
			},
			want: wantOut{fired: false},
		},
		{
			name: "SELL direction at exactly threshold fires (≥ is inclusive)",
			prev: marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 1_000_000},
			curr: marketvo.MarketQuote{
				TradingDate:    "2026-05-12",
				TotalTradedQty: 1_050_000, // delta = 50_000 == threshold
				MatchedPrice:   25.50,
				Best1Bid:       25.50, Best1Offer: 25.55,
			},
			want: wantOut{fired: true, direction: "SELL", delta: 50_000},
		},
	}

	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{
		Type:      configvo.AlertTypeTransactionVolumeSpike,
		Threshold: threshold,
		Enabled:   true,
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, fired := e.Evaluate(cond, tt.curr, tt.prev, nil)

			if fired != tt.want.fired {
				t.Fatalf("fired = %v, want %v (value=%q)", fired, tt.want.fired, got.Value)
			}
			if !tt.want.fired {
				if got != (EvaluationResult{}) {
					t.Errorf("expected zero EvaluationResult on no-fire, got %+v", got)
				}
				return
			}

			if got.Label != configvo.LabelMatchedVolumeBurst {
				t.Errorf("label = %q, want %q", got.Label, configvo.LabelMatchedVolumeBurst)
			}
			if !strings.Contains(got.Value, tt.want.direction) {
				t.Errorf("expected direction %q in value, got %q", tt.want.direction, got.Value)
			}
			// Direction labels are mutually exclusive in the formatted output.
			other := "BUY"
			if tt.want.direction == "BUY" {
				other = "SELL"
			}
			if strings.Contains(got.Value, other) {
				t.Errorf("value %q contains both directions; expected only %q", got.Value, tt.want.direction)
			}
			// Verify the reported delta is the one we mocked.
			if tt.want.delta > 0 {
				wantDeltaStr := fmtInt(tt.want.delta)
				if !strings.Contains(got.Value, wantDeltaStr) {
					t.Errorf("expected delta %s shares in value, got %q", wantDeltaStr, got.Value)
				}
			}
		})
	}
}

// fmtInt formats an int64 with no separators so it can be substring-matched
// against the evaluator's `%d` output.
func fmtInt(n int64) string {
	// 21 bytes covers the full int64 range plus a sign.
	buf := make([]byte, 0, 21)
	if n == 0 {
		return "0"
	}
	negative := n < 0
	if negative {
		n = -n
	}
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	if negative {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}

// TestEvaluate_TransactionVolumeSpike_BookDepthInOutput verifies that the
// cumulative L1+L2+L3 bid/ask depths are rendered correctly in the formatted
// Value so operators can read order-book context out of the Telegram message.
func TestEvaluate_TransactionVolumeSpike_BookDepthInOutput(t *testing.T) {
	e := NewAlertEvaluator()
	cond := configvo.AlertCondition{
		Type:      configvo.AlertTypeTransactionVolumeSpike,
		Threshold: 10_000,
		Enabled:   true,
	}

	prev := marketvo.MarketQuote{TradingDate: "2026-05-12", TotalTradedQty: 100_000}
	curr := marketvo.MarketQuote{
		TradingDate:    "2026-05-12",
		TotalTradedQty: 200_000, // delta = 100_000
		MatchedPrice:   30.00,
		Best1Bid:       29.95, Best1BidVol: 1_000,
		Best1Offer: 30.00, Best1OfferVol: 2_000,
		Best2BidVol: 500, Best3BidVol: 250,
		Best2OfferVol: 750, Best3OfferVol: 500,
	}
	// Expected depths: bid = 1000+500+250 = 1750; ask = 2000+750+500 = 3250
	got, fired := e.Evaluate(cond, curr, prev, nil)
	if !fired {
		t.Fatalf("expected fire")
	}
	if !strings.Contains(got.Value, "bid 1750") {
		t.Errorf("expected cumulative bid depth 1750 in value, got %q", got.Value)
	}
	if !strings.Contains(got.Value, "ask 3250") {
		t.Errorf("expected cumulative ask depth 3250 in value, got %q", got.Value)
	}
}
