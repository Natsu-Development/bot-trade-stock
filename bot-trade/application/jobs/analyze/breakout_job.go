package analyze

import (
	"context"
	"fmt"

	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	"bot-trade/application/jobs/registry"
	appPrep "bot-trade/application/usecase/analyze/prep"
	appTrendline "bot-trade/application/usecase/analyze/trendline"
)

func init() {
	registry.RegisterFactory("breakout", NewBreakoutJobsFromDeps)
}

// AnalyzeBreakout analyzes prepared data for trendline breakout signals.
func AnalyzeBreakout(ctx context.Context, data *appPrep.DataPrepare, uc *appTrendline.BreakoutUseCase, interval string) (outbound.Message, error) {
	_, signals, err := uc.Execute(data)
	if err != nil {
		return outbound.Message{}, err
	}

	filtered := FilterSignals(signals, []string{"breakout_potential"})
	if len(filtered) == 0 {
		return outbound.Message{}, nil
	}

	s := filtered[0]
	return outbound.Message{
		Title: "Trendline Breakout Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: data.Symbol},
			{Label: "Interval", Value: interval},
			{Label: "Signal", Value: s.Type},
			{Label: "Price", Value: fmt.Sprintf("%.2f", s.Price)},
			{Label: "Trendline", Value: fmt.Sprintf("%.2f", s.PriceLine)},
		},
	}, nil
}

func NewBreakoutJobsFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job
	jobCfg := deps.Config.BreakoutJob

	for interval, ic := range jobCfg.Intervals {
		if !ic.Enabled || ic.Schedule == "" {
			continue
		}

		jobs = append(jobs, &AnalysisJob{
			interval:      interval,
			schedule:      ic.Schedule,
			timeout:       jobCfg.Timeout,
			concurrency:   jobCfg.Concurrency,
			namePrefix:    "breakout",
			preparer:      deps.Preparer,
			configRepo:    deps.ConfigRepo,
			logger:        deps.Logger,
			notifier:      deps.Notifier,
			selectSymbols: SelectBullishSymbols,
			analyze: func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, error) {
				return AnalyzeBreakout(ctx, data, deps.BreakoutUC, interval)
			},
		})
	}
	return jobs, nil
}
