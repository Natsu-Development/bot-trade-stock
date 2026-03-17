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
	registry.RegisterFactory("bearish", NewBearishRSIJobsFromDeps)
}

// AnalyzeBearishRSI analyzes prepared data for bearish RSI divergence.
func AnalyzeBearishRSI(ctx context.Context, data *appPrep.DataPrepare, uc *appRsi.BearishRSIUseCase, interval string) (outbound.Message, error) {
	divergences, err := uc.Execute(data)
	if err != nil {
		return outbound.Message{}, err
	}

	if len(divergences) == 0 {
		return outbound.Message{}, nil
	}

	div := divergences[0]
	description := fmt.Sprintf("bearish divergence detected between %s and %s", div.Points[0].Date, div.Points[1].Date)
	if div.IsEarly {
		description = fmt.Sprintf("bearish early divergence detected between %s and %s", div.Points[0].Date, div.Points[1].Date)
	}

	return outbound.Message{
		Title: "Bearish Divergence Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: data.Symbol},
			{Label: "Interval", Value: interval},
			{Label: "Description", Value: description},
		},
	}, nil
}

func NewBearishRSIJobsFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job
	jobCfg := deps.Config.BearishJob

	for interval, ic := range jobCfg.Intervals {
		if !ic.Enabled || ic.Schedule == "" {
			continue
		}

		jobs = append(jobs, &AnalysisJob{
			interval:      interval,
			schedule:      ic.Schedule,
			timeout:       jobCfg.Timeout,
			concurrency:   jobCfg.Concurrency,
			namePrefix:    "bearish-rsi",
			preparer:      deps.Preparer,
			configRepo:    deps.ConfigRepo,
			logger:        deps.Logger,
			notifier:      deps.Notifier,
			selectSymbols: SelectBearishSymbols,
			analyze: func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, error) {
				return AnalyzeBearishRSI(ctx, data, deps.BearishRSIUC, interval)
			},
		})
	}
	return jobs, nil
}
