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
	RegisterFactory("bullish", NewBullishRSIJobsFromDeps)
}

// BullishRSIJob detects bullish divergences and sends notifications.
// It has a single responsibility: analyze bullish symbols for bullish divergence.
// Uses specialized BullishRSIUseCase for targeted analysis.
type BullishRSIJob struct {
	interval    string
	schedule    string
	timeout     time.Duration
	concurrency int
	preparer    *appPrep.Preparer    // Prepares data before use case
	usecase     *appRsi.BullishRSIUseCase // Pure analysis use case
	notifier    outbound.Notifier
	configRepo  outbound.ConfigRepository
	logger      *zap.Logger
}

// Metadata returns the job configuration.
func (j *BullishRSIJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:        "bullish-rsi-" + j.interval,
		Schedule:    j.schedule,
		Enabled:     true,
		Timeout:     j.timeout,
		Concurrency: j.concurrency,
	}
}

// Execute runs the bullish RSI analysis job.
func (j *BullishRSIJob) Execute(ctx context.Context) error {
	configs, err := j.configRepo.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("load configs: %w", err)
	}

	for _, cfg := range configs {
		j.processConfig(ctx, cfg)
	}
	return nil
}

func (j *BullishRSIJob) processConfig(ctx context.Context, cfg *configagg.TradingConfig) {
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(j.concurrency)

	for _, symbol := range cfg.BullishSymbols {
		symbol := symbol
		g.Go(func() error {
			j.analyze(gctx, string(symbol), cfg)
			return nil
		})
	}
	g.Wait()
}

func bullishSymbols(cfg *configagg.TradingConfig) []string {
	result := make([]string, len(cfg.BullishSymbols))
	for i, s := range cfg.BullishSymbols {
		result[i] = string(s)
	}
	return result
}

func (j *BullishRSIJob) analyze(ctx context.Context, symbol string, cfg *configagg.TradingConfig) {
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

	divergences, err := j.usecase.Execute(data)
	if err != nil {
		j.logger.Error("Analysis failed", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	if len(divergences) > 0 {
		j.notify(symbol, divergences, cfg)
	}
}

func (j *BullishRSIJob) notify(symbol string, divergences []dto.DivergenceDTO, cfg *configagg.TradingConfig) {
	div := divergences[0]
	description := fmt.Sprintf("%s divergence detected between %s and %s", div.Type, div.Points[0].Date, div.Points[1].Date)

	msg := outbound.Message{
		Title: "Bullish Divergence Alert",
		Fields: []outbound.Field{
			{Label: "Symbol", Value: symbol},
			{Label: "Interval", Value: j.interval},
			{Label: "Description", Value: description},
		},
	}
	if err := j.notifier.Send(context.Background(), cfg.Telegram, msg); err != nil {
		j.logger.Error("Failed to send notification",
			zap.String("symbol", symbol),
			zap.String("interval", j.interval),
			zap.Error(err),
		)
	}
}

// NewBullishRSIJobsFromDeps creates bullish RSI jobs for all enabled intervals.
func NewBullishRSIJobsFromDeps(deps JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job

	for interval, ic := range deps.Config.BullishIntervals() {
		if ic.Enabled && ic.Schedule != "" {
			jobs = append(jobs, &BullishRSIJob{
				interval:    interval,
				schedule:    ic.Schedule,
				timeout:     time.Duration(deps.Config.BullishTimeoutMinutes) * time.Minute,
				concurrency: deps.Config.BullishConcurrency,
				preparer:    deps.Preparer,
				usecase:     deps.BullishRSIUC,
				notifier:    deps.Notifier,
				configRepo:  deps.ConfigRepo,
				logger:      deps.Logger,
			})
		}
	}

	return jobs, nil
}
