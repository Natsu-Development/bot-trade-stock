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

	return []inbound.Job{&StockAlertJob{
		schedule:       ic.Schedule,
		timeout:        cfg.Timeout,
		configRepo:     deps.ConfigRepo,
		quoteProvider:  deps.QuoteProvider,
		metricsManager: deps.StockMetricsManager,
		notifier:       deps.Notifier,
		evaluator:      deps.AlertEvaluator,
		prevQuotes:     map[string]marketvo.MarketQuote{},
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

	var updated bool
	for i := range cfg.Alerts {
		alert := &cfg.Alerts[i]
		quote, ok := quotes[string(alert.Symbol)]
		if !ok {
			continue
		}
		prev := prevQuotes[string(alert.Symbol)] // zero-value if first observation

		var matched []outbound.Field
		for ci := range alert.Conditions {
			cond := &alert.Conditions[ci]
			if !cond.Enabled {
				continue
			}
			field, fired := j.evaluateCondition(*cond, quote, prev, metricsBySymbol[string(alert.Symbol)])
			if !fired {
				continue
			}
			matched = append(matched, field)
			cond.Enabled = false // per-condition auto-disable
		}

		if len(matched) == 0 {
			continue
		}
		updated = true

		msg := buildMessage(alert.Symbol, quote, matched)
		if err := j.notifier.Send(ctx, cfg.Telegram, msg); err != nil {
			zap.L().Error("Failed to send stock alert notification",
				zap.String("symbol", string(alert.Symbol)),
				zap.String("config_id", string(cfg.ID)),
				zap.Error(err),
			)
		}
	}

	if updated {
		if err := j.configRepo.Update(ctx, cfg); err != nil {
			zap.L().Error("Failed to persist alert auto-disable",
				zap.String("config_id", string(cfg.ID)),
				zap.Error(err),
			)
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
		outbound.Field{Label: "Price", Value: fmt.Sprintf("%.0f", quote.MatchedPrice)},
	)
	fields = append(fields, matches...)
	return outbound.Message{
		Title:  "Stock Alert",
		Fields: fields,
	}
}
