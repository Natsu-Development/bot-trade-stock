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
	registry.RegisterFactory("breakdown", NewBreakdownJobsFromDeps)
}

// AnalyzeBreakdown analyzes prepared data for trendline breakdown signals.
func AnalyzeBreakdown(ctx context.Context, data *appPrep.DataPrepare, uc *appTrendline.BreakdownUseCase, interval string) (outbound.Message, error) {
	_, signals, err := uc.Execute(data)
	if err != nil {
		return outbound.Message{}, err
	}

	filtered := FilterSignals(signals, []string{"bounce_potential"})
	if len(filtered) == 0 {
		return outbound.Message{}, nil
	}

	s := filtered[0]
	return outbound.Message{
		Title: "Trendline Breakdown Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: data.Symbol},
			{Label: "Interval", Value: interval},
			{Label: "Signal", Value: s.Type},
			{Label: "Price", Value: fmt.Sprintf("%.2f", s.Price)},
			{Label: "Trendline", Value: fmt.Sprintf("%.2f", s.PriceLine)},
		},
	}, nil
}

func NewBreakdownJobsFromDeps(deps registry.JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job
	jobCfg := deps.Config.BreakdownJob

	for interval, ic := range jobCfg.Intervals {
		if !ic.Enabled || ic.Schedule == "" {
			continue
		}

		jobs = append(jobs, &AnalysisJob{
			interval:      interval,
			schedule:      ic.Schedule,
			timeout:       jobCfg.Timeout,
			concurrency:   jobCfg.Concurrency,
			namePrefix:    "breakdown",
			preparer:      deps.Preparer,
			configRepo:    deps.ConfigRepo,
			logger:        deps.Logger,
			notifier:      deps.Notifier,
			selectSymbols: SelectBearishSymbols,
			analyze: func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, error) {
				return AnalyzeBreakdown(ctx, data, deps.BreakdownUC, interval)
			},
		})
	}
	return jobs, nil
}
