// Package watchlist provides the watchlist price/volume job.
package watchlist

import (
	"context"
	"fmt"
	"sync"
	"time"

	"backend/application/jobs/registry"
	"backend/application/port/inbound"
	"backend/application/port/outbound"
	appService "backend/application/service"
	configagg "backend/domain/config/aggregate"
	alertservice "backend/domain/config/service"
	configvo "backend/domain/config/valueobject"
	metricsagg "backend/domain/metrics/aggregate"
	marketvo "backend/domain/shared/valueobject/market"

	"go.uber.org/zap"
)

func init() {
	registry.RegisterFactory("watchlist", NewWatchlistJobFromDeps)
}

// WatchlistJob evaluates user-configured price/volume conditions against
// real-time market quotes and notifies on match.
type WatchlistJob struct {
	schedule      string
	timeout       time.Duration
	configRepo    outbound.ConfigRepository
	quoteProvider outbound.QuoteProvider
	// snapshotStore is the lock-free shared metrics snapshot the tick reads directly
	// (base metrics for volume_spike + price-cross MAs) via MetricsBySymbol — the
	// service-layer cache, NOT the StockMetricsManager use case. May be nil before
	// the cache warms; the evaluator treats nil metrics as "skip volume_spike".
	snapshotStore *appService.SnapshotStore
	notifier      outbound.Notifier
	evaluator     *alertservice.WatchlistEvaluator
	disabler      *appService.ConditionDisabler
	// trendlineStore is the lock-free per-config alert-level store. resist/support
	// alerts read THIS config's levels from here (not the shared snapshot, which
	// after no-system carries no levels). May be nil (levels then come off the
	// shared metrics — the pre-per-config behavior).
	trendlineStore *appService.AlertTrendlineStore

	// marketTz is HoSE-local (injected from JobDependencies.MarketTimezone)
	// for the IsHoSEActiveQuoteWindow gate.
	marketTz *time.Location
	// ignoreSessionGate, when true, runs Execute on every tick regardless of
	// the HoSE intraday session window. Dev/demo only.
	ignoreSessionGate bool
	// now is a clock seam: defaults to time.Now; tests override it.
	now func() time.Time

	// Last tick's full quotes map. Reference-swapped each tick.
	// Multi-condition consistency: every condition in a tick reads the same prev.
	prevQuotesMu sync.Mutex
	prevQuotes   map[string]marketvo.MarketQuote
}

// NewWatchlistJobFromDeps builds the watchlist job if enabled in config.
func NewWatchlistJobFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	cfg := deps.Config.Watchlist

	ic, ok := cfg.Intervals["default"]
	if !ok || !ic.Enabled || ic.Schedule == "" {
		return nil, nil
	}

	if deps.QuoteProvider == nil {
		return nil, fmt.Errorf("watchlist job requires a quote provider")
	}
	if deps.WatchlistEvaluator == nil {
		return nil, fmt.Errorf("watchlist job requires a watchlist evaluator")
	}
	if deps.ConditionDisabler == nil {
		return nil, fmt.Errorf("watchlist job requires a condition disabler")
	}
	if deps.MarketTimezone == nil {
		return nil, fmt.Errorf("watchlist job requires a market timezone")
	}

	return []inbound.Job{&WatchlistJob{
		schedule:          ic.Schedule,
		timeout:           cfg.Timeout,
		configRepo:        deps.ConfigRepo,
		quoteProvider:     deps.QuoteProvider,
		snapshotStore:     deps.SnapshotStore,
		notifier:          deps.Notifier,
		evaluator:         deps.WatchlistEvaluator,
		disabler:          deps.ConditionDisabler,
		trendlineStore:    deps.AlertTrendlineStore,
		marketTz:          deps.MarketTimezone,
		ignoreSessionGate: cfg.IgnoreSessionGate,
		now:               time.Now,
		prevQuotes:        map[string]marketvo.MarketQuote{},
	}}, nil
}

// Metadata returns job metadata for scheduler registration.
func (j *WatchlistJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:     "watchlist",
		Schedule: j.schedule,
		Timeout:  j.timeout,
	}
}

// Execute fetches quotes + configs and fires matching alerts.
// Stock metrics are read lock-free from the shared snapshot store's lookup map.
func (j *WatchlistJob) Execute(ctx context.Context) error {
	// Skip ticks outside the HoSE intraday quote window (ATO and lunch are
	// no-data periods; the provider would return stale data). Weekday gating
	// stays the cron's responsibility (WATCHLIST_SCHEDULE field-6 = "1-5").
	if !j.ignoreSessionGate && !marketvo.IsHoSEActiveQuoteWindow(j.now(), j.marketTz) {
		zap.L().Debug("watchlist job skipped: outside HoSE active quote window")
		return nil
	}

	quotes, err := j.quoteProvider.FetchAllQuotes(ctx)
	if err != nil {
		return fmt.Errorf("fetch quotes: %w", err)
	}

	// Lock-free read of the symbol→metrics map straight from the service-layer
	// snapshot store. May be nil before the cache warms; the evaluator already
	// treats nil metrics as "skip volume_spike".
	var metricsBySymbol map[string]*metricsagg.StockMetrics
	if j.snapshotStore != nil {
		metricsBySymbol = j.snapshotStore.MetricsBySymbol()
	}

	// O(1) reference swap: prev = last tick's map, install current for next tick.
	// The mutex guards against torn reads if a slow tick overlaps with the next.
	// Prices are kVND by adapter contract (QuoteProvider.FetchAllQuotes); the
	// scale is normalized at the infrastructure boundary, so no app-layer gate.
	j.prevQuotesMu.Lock()
	prev := j.prevQuotes
	j.prevQuotes = quotes
	j.prevQuotesMu.Unlock()

	configs, err := j.configRepo.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("load configs: %w", err)
	}

	for _, cfg := range configs {
		j.processConfig(ctx, cfg, quotes, prev, metricsBySymbol)
	}
	return nil
}

func (j *WatchlistJob) processConfig(
	ctx context.Context,
	cfg *configagg.TradingConfig,
	quotes map[string]marketvo.MarketQuote,
	prevQuotes map[string]marketvo.MarketQuote,
	metricsBySymbol map[string]*metricsagg.StockMetrics,
) {
	if len(cfg.Watchlist) == 0 {
		return
	}

	for i := range cfg.Watchlist {
		alert := &cfg.Watchlist[i]
		quote, ok := quotes[string(alert.Symbol)]
		if !ok {
			continue
		}
		prev := prevQuotes[string(alert.Symbol)] // zero-value if first observation

		// Base metrics (volume_spike SMA, price-cross MAs) come from the shared
		// snapshot, read-only; the per-config tick-time resistance/support levels
		// come from THIS config's alert store. Both are looked up once per symbol
		// and reused across its conditions; the shared snapshot entry is untouched.
		base := metricsBySymbol[string(alert.Symbol)]
		trendline := j.trendlineStore.TrendlineFor(string(cfg.ID), string(alert.Symbol))

		var matched []outbound.Field
		var firedConds []configvo.TriggerCondition
		for ci := range alert.Conditions {
			cond := alert.Conditions[ci]
			if !cond.Enabled || cond.Type.IsAnalyzeOnly() {
				// Analyze-only types (RSI divergence + multi-timeframe trendline) are
				// owned by the analyze jobs; never fire them on the tick path.
				continue
			}
			result, fired := j.evaluator.Evaluate(cond, quote, prev, base, trendline)
			if !fired {
				continue
			}
			matched = append(matched, outbound.Field{Label: result.Label, Value: result.Value})
			firedConds = append(firedConds, cond)
		}

		if len(matched) == 0 {
			continue
		}

		msg := buildMessage(alert.Symbol, quote, matched)
		if err := j.notifier.Send(ctx, cfg.Telegram, msg); err != nil {
			zap.L().Error("Failed to send watchlist notification",
				zap.String("symbol", string(alert.Symbol)),
				zap.String("config_id", string(cfg.ID)),
				zap.Error(err),
			)
			continue
		}

		// Auto-disable every fired condition via the scoped per-condition write so a
		// stale whole-doc snapshot never reverts the analyze jobs' concurrent disables.
		for _, cond := range firedConds {
			if err := j.disabler.Disable(ctx, string(cfg.ID), string(alert.Symbol), cond); err != nil {
				zap.L().Error("Failed to persist watchlist auto-disable",
					zap.String("symbol", string(alert.Symbol)),
					zap.String("config_id", string(cfg.ID)),
					zap.String("type", string(cond.Type)),
					zap.Error(err),
				)
			}
		}
	}
}

// buildMessage assembles the notification fields for a fired alert.
func buildMessage(symbol marketvo.Symbol, quote marketvo.MarketQuote, matches []outbound.Field) outbound.Message {
	fields := make([]outbound.Field, 0, 2+len(matches))
	fields = append(fields,
		outbound.Field{Label: "Symbol", Value: string(symbol)},
		outbound.Field{Label: "Price", Value: fmt.Sprintf("%.2f", quote.MatchedPrice)},
	)
	fields = append(fields, matches...)
	return outbound.Message{
		Title:  "Stock Alert",
		Fields: fields,
	}
}
