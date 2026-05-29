package analyze

import (
	"context"
	"fmt"
	"time"

	"bot-trade/application/dto"
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	appService "bot-trade/application/service"
	appPrep "bot-trade/application/usecase/analyze/prep"
	analysisvo "bot-trade/domain/analysis/valueobject"
	configagg "bot-trade/domain/config/aggregate"
	configvo "bot-trade/domain/config/valueobject"
	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

// SymbolSelector selects which symbols to analyze from a config.
type SymbolSelector func(cfg *configagg.TradingConfig) []marketvo.Symbol

// firstSignalOfType returns the first signal of the given type and whether one
// was found. Typed on analysisvo.SignalType so callers cannot pass a stray
// string literal for a signal that the detectors never emit.
func firstSignalOfType(signals []dto.SignalDTO, t analysisvo.SignalType) (dto.SignalDTO, bool) {
	for _, s := range signals {
		if s.Type == string(t) {
			return s, true
		}
	}
	return dto.SignalDTO{}, false
}

// withinSignalWindow reports whether a signal dated dateStr (layout "2006-01-02")
// falls within the last `days` days. days <= 0 disables the filter (always true).
// This applies the config SignalDaysThreshold recency window in the analyze jobs,
// so an alert fires only for a recently-formed trendline/divergence signal — not
// one from anywhere in the analyzed lookback range.
func withinSignalWindow(dateStr string, days int) bool {
	// Defensive: unset/non-positive config values mean "no filter".
	if days <= 0 {
		return true
	}
	if dateStr == "" {
		return false
	}
	d, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return false
	}
	return !d.Before(time.Now().AddDate(0, 0, -days))
}

// AnalyzeFunc performs analysis on prepared data and reports a message plus whether
// a signal fired. Returns (msg, true) on a signal, (zero, false) on no signal, or
// error on failure. The fired flag drives the auto-disable in analyzeSymbol.
type AnalyzeFunc func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, bool, error)

// AnalysisJob is a generic job that analyzes symbols using a strategy function.
type AnalysisJob struct {
	interval      string
	schedule      string
	timeout       time.Duration
	concurrency   int
	namePrefix    string
	preparer      *appPrep.Preparer
	configRepo    outbound.ConfigRepository
	notifier      outbound.Notifier
	disabler      *appService.ConditionDisabler
	selectSymbols SymbolSelector
	analyze       AnalyzeFunc
	// disableType is the condition type this job auto-disables on a fired signal.
	// Set per factory (bullish_divergence / bearish_divergence); identity is
	// (symbol, type) since divergence conditions carry no reference.
	disableType configvo.AlertType
}

func (j *AnalysisJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:        j.namePrefix + "-" + j.interval,
		Schedule:    j.schedule,
		Timeout:     j.timeout,
		Concurrency: j.concurrency,
	}
}

func (j *AnalysisJob) Execute(ctx context.Context) error {
	configs, err := j.configRepo.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("load configs: %w", err)
	}

	for _, cfg := range configs {
		j.processConfig(ctx, cfg)
	}
	return nil
}

func (j *AnalysisJob) processConfig(ctx context.Context, cfg *configagg.TradingConfig) {
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(j.concurrency)

	for _, symbol := range j.selectSymbols(cfg) {
		symbol := symbol
		g.Go(func() error {
			j.analyzeSymbol(gctx, string(symbol), cfg)
			return nil
		})
	}
	// Goroutines never return an error (analyzeSymbol logs and swallows its own
	// failures), so Wait cannot fail; discard explicitly to satisfy errcheck.
	_ = g.Wait()
}

func (j *AnalysisJob) analyzeSymbol(ctx context.Context, symbol string, cfg *configagg.TradingConfig) {
	// Scale LookbackDay by interval cadence so weekly/monthly jobs fetch enough
	// bars for the RSI/pivot/divergence pipeline. See ADR in
	// .omc/plans/analyze-interval-autoscale.md.
	interval, err := marketvo.NewInterval(j.interval)
	if err != nil {
		zap.L().Error("Invalid job interval",
			zap.String("symbol", symbol),
			zap.String("interval", j.interval),
			zap.Error(err),
		)
		return
	}
	effectiveLookback := marketvo.EffectiveLookbackDays(interval, cfg.LookbackDay)

	query, err := marketvo.NewMarketDataQueryFromStrings(symbol, "", j.interval, effectiveLookback)
	if err != nil {
		zap.L().Error("Failed to create query", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	data, err := j.preparer.Prepare(ctx, query, string(cfg.ID))
	if err != nil {
		zap.L().Error("Failed to prepare data", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	msg, fired, err := j.analyze(ctx, data, j.interval)
	if err != nil {
		zap.L().Error("Analysis failed", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	if !fired {
		return
	}

	if err := j.notifier.Send(ctx, cfg.Telegram, msg); err != nil {
		zap.L().Error("Failed to send notification", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	// Auto-disable the fired divergence condition via the scoped per-condition write
	// so concurrent tick-job disables on the same config are never clobbered.
	cond := configvo.AlertCondition{Type: j.disableType}
	if err := j.disabler.Disable(ctx, string(cfg.ID), symbol, cond); err != nil {
		zap.L().Error("Failed to persist divergence auto-disable",
			zap.String("symbol", symbol),
			zap.String("config_id", string(cfg.ID)),
			zap.String("type", string(j.disableType)),
			zap.Error(err),
		)
	}
}
