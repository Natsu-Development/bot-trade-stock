package analyze

import (
	"context"
	"fmt"

	"backend/application/jobs/registry"
	"backend/application/port/inbound"
	"backend/application/port/outbound"
	appPrep "backend/application/usecase/analyze/prep"
	appTrendline "backend/application/usecase/analyze/trendline"
	analysisvo "backend/domain/analysis/valueobject"
	configagg "backend/domain/config/aggregate"
	configvo "backend/domain/config/valueobject"
	marketvo "backend/domain/shared/valueobject/market"
)

func init() {
	registry.RegisterFactory("breakdown", NewBreakdownJobsFromDeps)
}

// AnalyzeBreakdown analyzes prepared data for a potential support-trendline
// breakdown and reports a message plus whether the signal fired.
func AnalyzeBreakdown(ctx context.Context, data *appPrep.DataPrepare, uc *appTrendline.BreakdownUseCase, interval string) (outbound.Message, bool, error) {
	_, signals, err := uc.Execute(data)
	if err != nil {
		return outbound.Message{}, false, err
	}

	sig, ok := firstSignalOfType(signals, analysisvo.BreakdownPotential)
	// Only fire when the signal is within the user's signal recency window.
	if !ok || !withinSignalWindow(sig.Time, data.Config.SignalDaysThreshold) {
		return outbound.Message{}, false, nil
	}

	return outbound.Message{
		Title: "Trendline Breakdown Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: data.Symbol},
			{Label: "Interval", Value: interval},
			{Label: "Signal", Value: sig.Type},
			{Label: "Price", Value: fmt.Sprintf("%.2f", sig.Price)},
			{Label: "Trendline", Value: fmt.Sprintf("%.2f", sig.PriceLine)},
		},
	}, true, nil
}

// NewBreakdownJobsFromDeps builds one multi-timeframe breakdown analyze job per
// enabled interval. Symbols come from the unified per-symbol Alerts that enabled
// trendline_breakdown_mtf; a fired signal auto-disables that condition.
func NewBreakdownJobsFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job
	jobCfg := deps.Config.BreakdownJob

	for interval, ic := range jobCfg.Intervals {
		if !ic.Enabled || ic.Schedule == "" {
			continue
		}

		jobs = append(jobs, &AnalysisJob{
			interval:    interval,
			schedule:    ic.Schedule,
			timeout:     jobCfg.Timeout,
			concurrency: jobCfg.Concurrency,
			namePrefix:  "breakdown",
			preparer:    deps.Preparer,
			configRepo:  deps.ConfigRepo,
			notifier:    deps.Notifier,
			disabler:    deps.ConditionDisabler,
			disableType: configvo.AlertTypeBreakdownMTF,
			selectSymbols: func(cfg *configagg.TradingConfig) []marketvo.Symbol {
				return cfg.SymbolsWithEnabledCondition(configvo.AlertTypeBreakdownMTF)
			},
			analyze: func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, bool, error) {
				return AnalyzeBreakdown(ctx, data, deps.BreakdownUC, interval)
			},
		})
	}
	return jobs, nil
}
