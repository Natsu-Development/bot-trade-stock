package analyze

import (
	"context"
	"fmt"

	"backend/application/jobs/registry"
	"backend/application/port/inbound"
	"backend/application/port/outbound"
	appPrep "backend/application/usecase/analyze/prep"
	appRsi "backend/application/usecase/analyze/rsi"
	configagg "backend/domain/config/aggregate"
	configvo "backend/domain/config/valueobject"
	marketvo "backend/domain/shared/valueobject/market"
)

func init() {
	registry.RegisterFactory("bullish", NewBullishRSIJobsFromDeps)
}

// AnalyzeBullishRSI analyzes prepared data for a CONFIRMED bullish RSI divergence.
func AnalyzeBullishRSI(ctx context.Context, data *appPrep.DataPrepare, uc *appRsi.BullishRSIUseCase, interval string) (outbound.Message, bool, error) {
	divergences, err := uc.Execute(data)
	if err != nil {
		return outbound.Message{}, false, err
	}
	if len(divergences) == 0 {
		return outbound.Message{}, false, nil
	}

	div := divergences[0]
	// Only fire when the most-recent pivot is within the user's signal recency window.
	if len(div.Points) == 0 || !withinSignalWindow(div.Points[len(div.Points)-1].Date, data.Config.SignalDaysThreshold) {
		return outbound.Message{}, false, nil
	}
	description := fmt.Sprintf("bullish divergence detected between %s and %s", div.Points[0].Date, div.Points[1].Date)

	return outbound.Message{
		Title: "Bullish Divergence Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: data.Symbol},
			{Label: "Interval", Value: interval},
			{Label: "Description", Value: description},
		},
	}, true, nil
}

// AnalyzeBullishRSIEarly analyzes prepared data for an EARLY (forming) bullish RSI divergence.
func AnalyzeBullishRSIEarly(ctx context.Context, data *appPrep.DataPrepare, uc *appRsi.BullishRSIUseCase, interval string) (outbound.Message, bool, error) {
	divergences, err := uc.ExecuteEarly(data)
	if err != nil {
		return outbound.Message{}, false, err
	}
	if len(divergences) == 0 {
		return outbound.Message{}, false, nil
	}

	div := divergences[0]
	// Only fire when the most-recent pivot is within the user's signal recency window.
	if len(div.Points) == 0 || !withinSignalWindow(div.Points[len(div.Points)-1].Date, data.Config.SignalDaysThreshold) {
		return outbound.Message{}, false, nil
	}
	description := fmt.Sprintf("early bullish divergence forming between %s and %s", div.Points[0].Date, div.Points[1].Date)

	return outbound.Message{
		Title: "Bullish Divergence Alert (Early)",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: data.Symbol},
			{Label: "Interval", Value: interval},
			{Label: "Description", Value: description},
		},
	}, true, nil
}

// NewBullishRSIJobsFromDeps builds, per enabled interval, a CONFIRMED bullish divergence
// job and an independent EARLY bullish divergence job. Each selects + auto-disables only
// its own AlertType, so firing one never affects the other's enabled state.
func NewBullishRSIJobsFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job
	jobCfg := deps.Config.BullishJob

	for interval, ic := range jobCfg.Intervals {
		if !ic.Enabled || ic.Schedule == "" {
			continue
		}

		jobs = append(jobs, &AnalysisJob{
			interval:    interval,
			schedule:    ic.Schedule,
			timeout:     jobCfg.Timeout,
			concurrency: jobCfg.Concurrency,
			namePrefix:  "bullish-rsi",
			preparer:    deps.Preparer,
			configRepo:  deps.ConfigRepo,
			notifier:    deps.Notifier,
			disabler:    deps.ConditionDisabler,
			disableType: configvo.AlertTypeBullishDivergence,
			selectSymbols: func(cfg *configagg.TradingConfig) []marketvo.Symbol {
				return cfg.SymbolsWithEnabledCondition(configvo.AlertTypeBullishDivergence)
			},
			analyze: func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, bool, error) {
				return AnalyzeBullishRSI(ctx, data, deps.BullishRSIUC, interval)
			},
		})

		jobs = append(jobs, &AnalysisJob{
			interval:    interval,
			schedule:    ic.Schedule,
			timeout:     jobCfg.Timeout,
			concurrency: jobCfg.Concurrency,
			namePrefix:  "bullish-rsi-early",
			preparer:    deps.Preparer,
			configRepo:  deps.ConfigRepo,
			notifier:    deps.Notifier,
			disabler:    deps.ConditionDisabler,
			disableType: configvo.AlertTypeBullishDivergenceEarly,
			selectSymbols: func(cfg *configagg.TradingConfig) []marketvo.Symbol {
				return cfg.SymbolsWithEnabledCondition(configvo.AlertTypeBullishDivergenceEarly)
			},
			analyze: func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, bool, error) {
				return AnalyzeBullishRSIEarly(ctx, data, deps.BullishRSIUC, interval)
			},
		})
	}
	return jobs, nil
}
