// Package alert provides the stock price/volume alert job.
package alert

import (
	"context"
	"fmt"
	"sync"
	"time"

	"bot-trade/application/jobs/registry"
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	appService "bot-trade/application/service"
	configagg "bot-trade/domain/config/aggregate"
	alertservice "bot-trade/domain/config/service"
	configvo "bot-trade/domain/config/valueobject"
	metricsagg "bot-trade/domain/metrics/aggregate"
	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
)

func init() {
	registry.RegisterFactory("stock_alert", NewStockAlertJobFromDeps)
}

// StockAlertJob evaluates user-configured price/volume conditions against
// real-time market quotes and notifies on match.
type StockAlertJob struct {
	schedule       string
	timeout        time.Duration
	configRepo     outbound.ConfigRepository
	quoteProvider  outbound.QuoteProvider
	metricsManager inbound.StockMetricsManager
	notifier       outbound.Notifier
	evaluator      *alertservice.AlertEvaluator
	disabler       *appService.ConditionDisabler

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

// NewStockAlertJobFromDeps builds the alert job if enabled in config.
func NewStockAlertJobFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	cfg := deps.Config.StockAlert

	ic, ok := cfg.Intervals["default"]
	if !ok || !ic.Enabled || ic.Schedule == "" {
		return nil, nil
	}

	if deps.QuoteProvider == nil {
		return nil, fmt.Errorf("stock alert job requires a quote provider")
	}
	if deps.AlertEvaluator == nil {
		return nil, fmt.Errorf("stock alert job requires an alert evaluator")
	}
	if deps.ConditionDisabler == nil {
		return nil, fmt.Errorf("stock alert job requires a condition disabler")
	}
	if deps.MarketTimezone == nil {
		return nil, fmt.Errorf("stock alert job requires a market timezone")
	}

	return []inbound.Job{&StockAlertJob{
		schedule:          ic.Schedule,
		timeout:           cfg.Timeout,
		configRepo:        deps.ConfigRepo,
		quoteProvider:     deps.QuoteProvider,
		metricsManager:    deps.StockMetricsManager,
		notifier:          deps.Notifier,
		evaluator:         deps.AlertEvaluator,
		disabler:          deps.ConditionDisabler,
		marketTz:          deps.MarketTimezone,
		ignoreSessionGate: cfg.IgnoreSessionGate,
		now:               time.Now,
		prevQuotes:        map[string]marketvo.MarketQuote{},
	}}, nil
}

// Metadata returns job metadata for scheduler registration.
func (j *StockAlertJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:     "stock-alert",
		Schedule: j.schedule,
		Timeout:  j.timeout,
	}
}

// Execute fetches quotes + configs and fires matching alerts.
// Stock metrics are read lock-free from the manager's shared lookup map.
func (j *StockAlertJob) Execute(ctx context.Context) error {
	// Skip ticks outside the HoSE intraday quote window (ATO and lunch are
	// no-data periods; the provider would return stale data). Weekday gating
	// stays the cron's responsibility (STOCK_ALERT_SCHEDULE field-6 = "1-5").
	if !j.ignoreSessionGate && !marketvo.IsHoSEActiveQuoteWindow(j.now(), j.marketTz) {
		zap.L().Debug("stock alert job skipped: outside HoSE active quote window")
		return nil
	}

	quotes, err := j.quoteProvider.FetchAllQuotes(ctx)
	if err != nil {
		return fmt.Errorf("fetch quotes: %w", err)
	}

	// Lock-free read of the symbol→metrics map. May be nil before the cache
	// warms; the evaluator already treats nil metrics as "skip volume_spike".
	var metricsBySymbol map[string]*metricsagg.StockMetrics
	if j.metricsManager != nil {
		metricsBySymbol = j.metricsManager.MetricsBySymbol()
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

func (j *StockAlertJob) processConfig(
	ctx context.Context,
	cfg *configagg.TradingConfig,
	quotes map[string]marketvo.MarketQuote,
	prevQuotes map[string]marketvo.MarketQuote,
	metricsBySymbol map[string]*metricsagg.StockMetrics,
) {
	if len(cfg.Alerts) == 0 {
		return
	}

	for i := range cfg.Alerts {
		alert := &cfg.Alerts[i]
		quote, ok := quotes[string(alert.Symbol)]
		if !ok {
			continue
		}
		prev := prevQuotes[string(alert.Symbol)] // zero-value if first observation

		var matched []outbound.Field
		var firedConds []configvo.AlertCondition
		for ci := range alert.Conditions {
			cond := alert.Conditions[ci]
			if !cond.Enabled || cond.Type.IsAnalyzeOnly() {
				// Analyze-only types (RSI divergence + multi-timeframe trendline) are
				// owned by the analyze jobs; never fire them on the tick path.
				continue
			}
			field, fired := j.evaluateCondition(cond, quote, prev, metricsBySymbol[string(alert.Symbol)])
			if !fired {
				continue
			}
			matched = append(matched, field)
			firedConds = append(firedConds, cond)
		}

		if len(matched) == 0 {
			continue
		}

		msg := buildMessage(alert.Symbol, quote, matched)
		if err := j.notifier.Send(ctx, cfg.Telegram, msg); err != nil {
			zap.L().Error("Failed to send stock alert notification",
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
				zap.L().Error("Failed to persist alert auto-disable",
					zap.String("symbol", string(alert.Symbol)),
					zap.String("config_id", string(cfg.ID)),
					zap.String("type", string(cond.Type)),
					zap.Error(err),
				)
			}
		}
	}
}

// evaluateCondition projects the domain evaluator's result into an outbound.Field.
// No fire/no-fire logic and no AlertType switch here — all of that lives in the
// AlertEvaluator domain service.
func (j *StockAlertJob) evaluateCondition(
	cond configvo.AlertCondition,
	quote marketvo.MarketQuote,
	prev marketvo.MarketQuote,
	metrics *metricsagg.StockMetrics,
) (outbound.Field, bool) {
	result, fired := j.evaluator.Evaluate(cond, quote, prev, metrics)
	if !fired {
		return outbound.Field{}, false
	}
	return outbound.Field{Label: result.Label, Value: result.Value}, true
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
