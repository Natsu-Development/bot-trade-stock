package service

import (
	"context"
	"fmt"
	"time"

	"bot-trade/application/dto"
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	appPrep "bot-trade/application/usecase/analyze/prep"
	appTrendline "bot-trade/application/usecase/analyze/trendline"
	configagg "bot-trade/domain/config/aggregate"
	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

func init() {
	RegisterFactory("breakdown", NewBreakdownJobsFromDeps)
}

type BreakdownJob struct {
	interval    string
	schedule    string
	timeout     time.Duration
	concurrency int
	uc          *appTrendline.BreakdownUseCase
	preparer    *appPrep.Preparer
	notifier    outbound.Notifier
	configRepo  outbound.ConfigRepository
	logger      *zap.Logger
}

func (j *BreakdownJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:        "breakdown-" + j.interval,
		Schedule:    j.schedule,
		Enabled:     true,
		Timeout:     j.timeout,
		Concurrency: j.concurrency,
	}
}

func (j *BreakdownJob) Execute(ctx context.Context) error {
	configs, err := j.configRepo.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("load configs: %w", err)
	}

	for _, cfg := range configs {
		j.processConfig(ctx, cfg)
	}
	return nil
}

func (j *BreakdownJob) processConfig(ctx context.Context, cfg *configagg.TradingConfig) {
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(j.concurrency)

	for _, symbol := range cfg.BearishSymbols {
		symbol := symbol
		g.Go(func() error {
			j.analyzeSymbol(gctx, string(symbol), cfg)
			return nil
		})
	}
	g.Wait()
}

func (j *BreakdownJob) analyzeSymbol(ctx context.Context, symbol string, cfg *configagg.TradingConfig) {
	query, err := marketvo.NewMarketDataQueryFromStrings(symbol, "", j.interval, cfg.LookbackDay)
	if err != nil {
		j.logger.Error("Failed to create query", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	data, err := j.preparer.Prepare(ctx, query, string(cfg.ID))
	if err != nil {
		j.logger.Error("Failed to prepare data", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	_, signals, err := j.uc.Execute(data)
	if err != nil {
		j.logger.Error("Analysis failed", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	filtered := j.filterSignals(signals)
	if len(filtered) > 0 {
		j.notify(ctx, filtered[0], symbol, cfg)
	}
}

func (j *BreakdownJob) filterSignals(signals []dto.SignalDTO) []dto.SignalDTO {
	var filtered []dto.SignalDTO
	for _, s := range signals {
		if s.Type == "bounce_confirmed" || s.Type == "bounce_potential" {
			filtered = append(filtered, s)
		}
	}
	return filtered
}

func (j *BreakdownJob) notify(ctx context.Context, s dto.SignalDTO, symbol string, cfg *configagg.TradingConfig) {
	msg := outbound.Message{
		Title: "Trendline Breakdown Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: symbol},
			{Label: "Interval", Value: j.interval},
			{Label: "Signal", Value: s.Type},
			{Label: "Price", Value: fmt.Sprintf("%.2f", s.Price)},
			{Label: "Trendline", Value: fmt.Sprintf("%.2f", s.PriceLine)},
		},
	}

	if err := j.notifier.Send(ctx, cfg.Telegram, msg); err != nil {
		j.logger.Error("Failed to send notification", zap.String("symbol", symbol), zap.Error(err))
	}
}

func NewBreakdownJobsFromDeps(deps JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job
	jobCfg := deps.Config.BreakdownJob

	for interval, ic := range jobCfg.Intervals {
		if ic.Enabled && ic.Schedule != "" {
			jobs = append(jobs, &BreakdownJob{
				interval:    interval,
				schedule:    ic.Schedule,
				timeout:     jobCfg.Timeout,
				concurrency: jobCfg.Concurrency,
				uc:          deps.BreakdownUC,
				preparer:    deps.Preparer,
				notifier:    deps.Notifier,
				configRepo:  deps.ConfigRepo,
				logger:      deps.Logger,
			})
		}
	}
	return jobs, nil
}
