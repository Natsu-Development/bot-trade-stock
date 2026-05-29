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
	registry.RegisterFactory("bearish", NewBearishRSIJobsFromDeps)
}

// AnalyzeBearishRSI analyzes prepared data for a CONFIRMED bearish RSI divergence.
func AnalyzeBearishRSI(ctx context.Context, data *appPrep.DataPrepare, uc *appRsi.BearishRSIUseCase, interval string) (outbound.Message, bool, error) {
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
	description := fmt.Sprintf("bearish divergence detected between %s and %s", div.Points[0].Date, div.Points[1].Date)

	return outbound.Message{
		Title: "Bearish Divergence Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: data.Symbol},
			{Label: "Interval", Value: interval},
			{Label: "Description", Value: description},
		},
	}, true, nil
}

// AnalyzeBearishRSIEarly analyzes prepared data for an EARLY (forming) bearish RSI divergence.
func AnalyzeBearishRSIEarly(ctx context.Context, data *appPrep.DataPrepare, uc *appRsi.BearishRSIUseCase, interval string) (outbound.Message, bool, error) {
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
	description := fmt.Sprintf("early bearish divergence forming between %s and %s", div.Points[0].Date, div.Points[1].Date)

	return outbound.Message{
		Title: "Bearish Divergence Alert (Early)",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: data.Symbol},
			{Label: "Interval", Value: interval},
			{Label: "Description", Value: description},
		},
	}, true, nil
}

// NewBearishRSIJobsFromDeps builds, per enabled interval, a CONFIRMED bearish divergence
// job and an independent EARLY bearish divergence job. Each selects + auto-disables only
// its own AlertType, so firing one never affects the other's enabled state.
func NewBearishRSIJobsFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job
	jobCfg := deps.Config.BearishJob

	for interval, ic := range jobCfg.Intervals {
		if !ic.Enabled || ic.Schedule == "" {
			continue
		}

		jobs = append(jobs, &AnalysisJob{
			interval:    interval,
			schedule:    ic.Schedule,
			timeout:     jobCfg.Timeout,
			concurrency: jobCfg.Concurrency,
			namePrefix:  "bearish-rsi",
			preparer:    deps.Preparer,
			configRepo:  deps.ConfigRepo,
			notifier:    deps.Notifier,
			disabler:    deps.ConditionDisabler,
			disableType: configvo.AlertTypeBearishDivergence,
			selectSymbols: func(cfg *configagg.TradingConfig) []marketvo.Symbol {
				return cfg.SymbolsWithEnabledCondition(configvo.AlertTypeBearishDivergence)
			},
			analyze: func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, bool, error) {
				return AnalyzeBearishRSI(ctx, data, deps.BearishRSIUC, interval)
			},
		})

		jobs = append(jobs, &AnalysisJob{
			interval:    interval,
			schedule:    ic.Schedule,
			timeout:     jobCfg.Timeout,
			concurrency: jobCfg.Concurrency,
			namePrefix:  "bearish-rsi-early",
			preparer:    deps.Preparer,
			configRepo:  deps.ConfigRepo,
			notifier:    deps.Notifier,
			disabler:    deps.ConditionDisabler,
			disableType: configvo.AlertTypeBearishDivergenceEarly,
			selectSymbols: func(cfg *configagg.TradingConfig) []marketvo.Symbol {
				return cfg.SymbolsWithEnabledCondition(configvo.AlertTypeBearishDivergenceEarly)
			},
			analyze: func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, bool, error) {
				return AnalyzeBearishRSIEarly(ctx, data, deps.BearishRSIUC, interval)
			},
		})
	}
	return jobs, nil
}
