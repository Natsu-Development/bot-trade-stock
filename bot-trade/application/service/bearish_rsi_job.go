package service

import (
	"context"
	"fmt"
	"time"

	"bot-trade/application/dto"
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	appPrep "bot-trade/application/usecase/analyze/prep"
	appRsi "bot-trade/application/usecase/analyze/rsi"
	configagg "bot-trade/domain/config/aggregate"
	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

func init() {
	RegisterFactory("bearish", NewBearishRSIJobsFromDeps)
}

type BearishRSIJob struct {
	interval    string
	schedule    string
	timeout     time.Duration
	concurrency int
	uc          *appRsi.BearishRSIUseCase
	preparer    *appPrep.Preparer
	notifier    outbound.Notifier
	configRepo  outbound.ConfigRepository
	logger      *zap.Logger
}

func (j *BearishRSIJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:        "bearish-rsi-" + j.interval,
		Schedule:    j.schedule,
		Enabled:     true,
		Timeout:     j.timeout,
		Concurrency: j.concurrency,
	}
}

func (j *BearishRSIJob) Execute(ctx context.Context) error {
	configs, err := j.configRepo.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("load configs: %w", err)
	}

	for _, cfg := range configs {
		j.processConfig(ctx, cfg)
	}
	return nil
}

func (j *BearishRSIJob) processConfig(ctx context.Context, cfg *configagg.TradingConfig) {
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

func (j *BearishRSIJob) analyzeSymbol(ctx context.Context, symbol string, cfg *configagg.TradingConfig) {
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

	divergences, err := j.uc.Execute(data)
	if err != nil {
		j.logger.Error("Analysis failed", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	if len(divergences) > 0 {
		j.notify(ctx, divergences[0], symbol, cfg)
	}
}

func (j *BearishRSIJob) notify(ctx context.Context, div dto.DivergenceDTO, symbol string, cfg *configagg.TradingConfig) {
	description := fmt.Sprintf("bearish divergence detected between %s and %s",
		div.Points[0].Date, div.Points[1].Date)
	if div.IsEarly {
		description = fmt.Sprintf("bearish early divergence detected between %s and %s",
			div.Points[0].Date, div.Points[1].Date)
	}

	msg := outbound.Message{
		Title: "Bearish Divergence Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: symbol},
			{Label: "Interval", Value: j.interval},
			{Label: "Description", Value: description},
		},
	}

	if err := j.notifier.Send(ctx, cfg.Telegram, msg); err != nil {
		j.logger.Error("Failed to send notification", zap.String("symbol", symbol), zap.Error(err))
	}
}

func NewBearishRSIJobsFromDeps(deps JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job
	jobCfg := deps.Config.BearishJob

	for interval, ic := range jobCfg.Intervals {
		if ic.Enabled && ic.Schedule != "" {
			jobs = append(jobs, &BearishRSIJob{
				interval:    interval,
				schedule:    ic.Schedule,
				timeout:     jobCfg.Timeout,
				concurrency: jobCfg.Concurrency,
				uc:          deps.BearishRSIUC,
				preparer:    deps.Preparer,
				notifier:    deps.Notifier,
				configRepo:  deps.ConfigRepo,
				logger:      deps.Logger,
			})
		}
	}
	return jobs, nil
}
