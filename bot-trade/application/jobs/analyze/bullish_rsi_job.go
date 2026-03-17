package analyze

import (
	"context"
	"fmt"

	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	"bot-trade/application/jobs/registry"
	appPrep "bot-trade/application/usecase/analyze/prep"
	appRsi "bot-trade/application/usecase/analyze/rsi"
)

func init() {
	registry.RegisterFactory("bullish", NewBullishRSIJobsFromDeps)
}

// AnalyzeBullishRSI analyzes prepared data for bullish RSI divergence.
func AnalyzeBullishRSI(ctx context.Context, data *appPrep.DataPrepare, uc *appRsi.BullishRSIUseCase, interval string) (outbound.Message, error) {
	divergences, err := uc.Execute(data)
	if err != nil {
		return outbound.Message{}, err
	}

	if len(divergences) == 0 {
		return outbound.Message{}, nil
	}

	div := divergences[0]
	description := fmt.Sprintf("bullish divergence detected between %s and %s", div.Points[0].Date, div.Points[1].Date)

	return outbound.Message{
		Title: "Bullish Divergence Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: data.Symbol},
			{Label: "Interval", Value: interval},
			{Label: "Description", Value: description},
		},
	}, nil
}

func NewBullishRSIJobsFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job
	jobCfg := deps.Config.BullishJob

	for interval, ic := range jobCfg.Intervals {
		if !ic.Enabled || ic.Schedule == "" {
			continue
		}

		jobs = append(jobs, &AnalysisJob{
			interval:      interval,
			schedule:      ic.Schedule,
			timeout:       jobCfg.Timeout,
			concurrency:   jobCfg.Concurrency,
			namePrefix:    "bullish-rsi",
			preparer:      deps.Preparer,
			configRepo:    deps.ConfigRepo,
			logger:        deps.Logger,
			notifier:      deps.Notifier,
			selectSymbols: SelectBullishSymbols,
			analyze: func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, error) {
				return AnalyzeBullishRSI(ctx, data, deps.BullishRSIUC, interval)
			},
		})
	}
	return jobs, nil
}
