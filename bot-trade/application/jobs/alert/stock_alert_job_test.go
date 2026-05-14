package alert

import (
	"context"
	"sync"
	"testing"
	"time"

	"bot-trade/application/dto"
	"bot-trade/application/port/outbound"
	configagg "bot-trade/domain/config/aggregate"
	alertservice "bot-trade/domain/config/service"
	configvo "bot-trade/domain/config/valueobject"
	metricsagg "bot-trade/domain/metrics/aggregate"
	filtervo "bot-trade/domain/shared/valueobject/filter"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// --- stubs ---

type stubConfigRepo struct {
	configs []*configagg.TradingConfig
	updated []*configagg.TradingConfig
	mu      sync.Mutex
}

func (r *stubConfigRepo) Create(context.Context, *configagg.TradingConfig) error { return nil }
func (r *stubConfigRepo) GetByID(context.Context, string) (*configagg.TradingConfig, error) {
	return nil, nil
}
func (r *stubConfigRepo) GetAll(context.Context) ([]*configagg.TradingConfig, error) {
	return r.configs, nil
}
func (r *stubConfigRepo) Update(_ context.Context, cfg *configagg.TradingConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.updated = append(r.updated, cfg)
	return nil
}
func (r *stubConfigRepo) Delete(context.Context, string) error { return nil }

type stubQuoteProvider struct {
	tick    int
	quotes  []map[string]marketvo.MarketQuote
}

func (p *stubQuoteProvider) FetchAllQuotes(context.Context) (map[string]marketvo.MarketQuote, error) {
	q := p.quotes[p.tick]
	if p.tick < len(p.quotes)-1 {
		p.tick++
	}
	return q, nil
}

type stubMetricsManager struct {
	result *dto.StockMetricsResult
}

func (m *stubMetricsManager) Refresh(context.Context) (*dto.StockMetricsResult, error) {
	return m.result, nil
}
func (m *stubMetricsManager) Filter(context.Context, *filtervo.StockFilter) (*dto.StockMetricsResult, error) {
	return m.result, nil
}
func (m *stubMetricsManager) GetCacheInfo() (time.Time, int, bool) {
	return time.Time{}, 0, false
}
func (m *stubMetricsManager) MetricsBySymbol() map[string]*metricsagg.StockMetrics {
	if m.result == nil {
		return nil
	}
	out := make(map[string]*metricsagg.StockMetrics, len(m.result.Stocks))
	for _, sm := range m.result.Stocks {
		out[string(sm.Symbol)] = sm
	}
	return out
}

type stubNotifier struct {
	sent []outbound.Message
	mu   sync.Mutex
}

func (n *stubNotifier) Send(_ context.Context, _ configvo.Telegram, msg outbound.Message) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.sent = append(n.sent, msg)
	return nil
}

// --- tests ---

func TestProcessConfig_PerConditionAutoDisable(t *testing.T) {
	// Three armed conditions on a single alert; only price_above should match.
	sym := marketvo.Symbol("HPG")
	cfg := &configagg.TradingConfig{
		ID: "u1",
		Alerts: []configvo.StockAlertConfig{
			{
				Symbol: sym,
				Conditions: []configvo.AlertCondition{
					{Type: configvo.AlertTypePriceAbove, Threshold: 25.0, Enabled: true},
					{Type: configvo.AlertTypePriceBelow, Threshold: 10.0, Enabled: true},
					{Type: configvo.AlertTypeVolumeSpike, Threshold: 9999, Enabled: true},
				},
			},
		},
	}
	repo := &stubConfigRepo{configs: []*configagg.TradingConfig{cfg}}
	quote := marketvo.MarketQuote{
		Symbol: "HPG", MatchedPrice: 25.50, TotalTradedQty: 100,
		Best1Bid: 25.45, Best1Offer: 25.50,
	}
	provider := &stubQuoteProvider{quotes: []map[string]marketvo.MarketQuote{{"HPG": quote}}}
	notifier := &stubNotifier{}
	metrics := &stubMetricsManager{result: &dto.StockMetricsResult{
		Stocks: []*metricsagg.StockMetrics{{Symbol: sym, VolumeSMA20: 100_000}},
	}}

	job := &StockAlertJob{
		configRepo:     repo,
		quoteProvider:  provider,
		metricsManager: metrics,
		notifier:       notifier,
		evaluator:      alertservice.NewAlertEvaluator(),
		prevQuotes:     map[string]marketvo.MarketQuote{},
	}

	if err := job.Execute(context.Background()); err != nil {
		t.Fatalf("Execute: %v", err)
	}

	conds := cfg.Alerts[0].Conditions
	if conds[0].Enabled {
		t.Error("price_above should have auto-disabled after firing")
	}
	if !conds[1].Enabled {
		t.Error("price_below should remain armed (did not fire)")
	}
	if !conds[2].Enabled {
		t.Error("volume_spike should remain armed (did not fire)")
	}
	if len(notifier.sent) != 1 {
		t.Errorf("expected exactly 1 notification, got %d", len(notifier.sent))
	}
	if len(repo.updated) != 1 {
		t.Errorf("expected config update once, got %d", len(repo.updated))
	}
}

func TestProcessConfig_NoMatchSkipsUpdate(t *testing.T) {
	sym := marketvo.Symbol("HPG")
	cfg := &configagg.TradingConfig{
		ID: "u1",
		Alerts: []configvo.StockAlertConfig{
			{
				Symbol: sym,
				Conditions: []configvo.AlertCondition{
					{Type: configvo.AlertTypePriceAbove, Threshold: 100.0, Enabled: true},
				},
			},
		},
	}
	repo := &stubConfigRepo{configs: []*configagg.TradingConfig{cfg}}
	provider := &stubQuoteProvider{quotes: []map[string]marketvo.MarketQuote{{
		"HPG": {Symbol: "HPG", MatchedPrice: 25.0},
	}}}
	notifier := &stubNotifier{}

	job := &StockAlertJob{
		configRepo:    repo,
		quoteProvider: provider,
		notifier:      notifier,
		evaluator:     alertservice.NewAlertEvaluator(),
		prevQuotes:    map[string]marketvo.MarketQuote{},
	}
	if err := job.Execute(context.Background()); err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(notifier.sent) != 0 {
		t.Errorf("expected no notification, got %d", len(notifier.sent))
	}
	if len(repo.updated) != 0 {
		t.Errorf("expected no config update, got %d", len(repo.updated))
	}
}

func TestProcessConfig_DisabledConditionSkipped(t *testing.T) {
	sym := marketvo.Symbol("HPG")
	cfg := &configagg.TradingConfig{
		ID: "u1",
		Alerts: []configvo.StockAlertConfig{
			{
				Symbol: sym,
				Conditions: []configvo.AlertCondition{
					// Already disabled — even though it would match, it must be skipped.
					{Type: configvo.AlertTypePriceAbove, Threshold: 1.0, Enabled: false},
				},
			},
		},
	}
	repo := &stubConfigRepo{configs: []*configagg.TradingConfig{cfg}}
	provider := &stubQuoteProvider{quotes: []map[string]marketvo.MarketQuote{{
		"HPG": {Symbol: "HPG", MatchedPrice: 999},
	}}}
	notifier := &stubNotifier{}

	job := &StockAlertJob{
		configRepo:    repo,
		quoteProvider: provider,
		notifier:      notifier,
		evaluator:     alertservice.NewAlertEvaluator(),
		prevQuotes:    map[string]marketvo.MarketQuote{},
	}
	if err := job.Execute(context.Background()); err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(notifier.sent) != 0 {
		t.Errorf("disabled condition should not fire; got %d notifications", len(notifier.sent))
	}
}

func TestProcessConfig_TransactionVolumeSpike_SilentColdStart(t *testing.T) {
	// On the first Execute, prevQuotes is empty for every symbol, so the
	// matched-volume delta is invalid and the condition does NOT fire.
	sym := marketvo.Symbol("HPG")
	cfg := &configagg.TradingConfig{
		ID: "u1",
		Alerts: []configvo.StockAlertConfig{
			{
				Symbol: sym,
				Conditions: []configvo.AlertCondition{
					{Type: configvo.AlertTypeTransactionVolumeSpike, Threshold: 1_000, Enabled: true},
				},
			},
		},
	}
	repo := &stubConfigRepo{configs: []*configagg.TradingConfig{cfg}}
	tick1 := map[string]marketvo.MarketQuote{
		"HPG": {Symbol: "HPG", TradingDate: "2026-05-12", TotalTradedQty: 100_000,
			MatchedPrice: 25.55, Best1Bid: 25.50, Best1Offer: 25.55},
	}
	tick2 := map[string]marketvo.MarketQuote{
		"HPG": {Symbol: "HPG", TradingDate: "2026-05-12", TotalTradedQty: 150_000,
			MatchedPrice: 25.60, Best1Bid: 25.55, Best1Offer: 25.60},
	}
	provider := &stubQuoteProvider{quotes: []map[string]marketvo.MarketQuote{tick1, tick2}}
	notifier := &stubNotifier{}

	job := &StockAlertJob{
		configRepo:    repo,
		quoteProvider: provider,
		notifier:      notifier,
		evaluator:     alertservice.NewAlertEvaluator(),
		prevQuotes:    map[string]marketvo.MarketQuote{},
	}

	// Tick 1: cold start, no fire.
	if err := job.Execute(context.Background()); err != nil {
		t.Fatalf("tick1 Execute: %v", err)
	}
	if len(notifier.sent) != 0 {
		t.Fatalf("tick1 should not fire (cold start), got %d notifications", len(notifier.sent))
	}
	if !cfg.Alerts[0].Conditions[0].Enabled {
		t.Fatalf("tick1 should not auto-disable condition")
	}

	// Tick 2: delta = 50_000 ≥ 1_000, BUY direction → fire.
	if err := job.Execute(context.Background()); err != nil {
		t.Fatalf("tick2 Execute: %v", err)
	}
	if len(notifier.sent) != 1 {
		t.Errorf("tick2 should fire once, got %d", len(notifier.sent))
	}
	if cfg.Alerts[0].Conditions[0].Enabled {
		t.Errorf("tick2 should auto-disable the matched condition")
	}
}
