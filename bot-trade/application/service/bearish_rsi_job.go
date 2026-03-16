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

// BearishRSIJob detects bearish divergences and sends notifications.
// It has a single responsibility: analyze bearish symbols for bearish divergence.
// Uses specialized BearishRSIUseCase for targeted analysis.
type BearishRSIJob struct {
	interval    string
	schedule    string
	timeout     time.Duration
	concurrency int
	preparer    *appPrep.Preparer     // Prepares data before use case
	usecase     *appRsi.BearishRSIUseCase // Pure analysis use case
	notifier    outbound.Notifier
	configRepo  outbound.ConfigRepository
	logger      *zap.Logger
}

// Metadata returns the job configuration.
func (j *BearishRSIJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:        "bearish-rsi-" + j.interval,
		Schedule:    j.schedule,
		Enabled:     true,
		Timeout:     j.timeout,
		Concurrency: j.concurrency,
	}
}

// Execute runs the bearish RSI analysis job.
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
			j.analyze(gctx, string(symbol), cfg)
			return nil
		})
	}
	g.Wait()
}

func (j *BearishRSIJob) analyze(ctx context.Context, symbol string, cfg *configagg.TradingConfig) {
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

func (j *BearishRSIJob) notify(symbol string, divergences []dto.DivergenceDTO, cfg *configagg.TradingConfig) {
	div := divergences[0]
	description := formatDivergenceDescription(div)

	msg := outbound.Message{
		Title: "Bearish Divergence Alert",
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

// formatDivergenceDescription formats a divergence DTO for notifications.
func formatDivergenceDescription(div dto.DivergenceDTO) string {
	if div.IsEarly {
		return fmt.Sprintf("%s early divergence detected between %s and %s",
			div.Type, div.Points[0].Date, div.Points[1].Date)
	}
	return fmt.Sprintf("%s divergence detected between %s and %s",
		div.Type, div.Points[0].Date, div.Points[1].Date)
}

// NewBearishRSIJobsFromDeps creates bearish RSI jobs for all enabled intervals.
func NewBearishRSIJobsFromDeps(deps JobDependencies) ([]inbound.Job, error) {
	var jobs []inbound.Job

	for interval, ic := range deps.Config.BearishIntervals() {
		if ic.Enabled && ic.Schedule != "" {
			jobs = append(jobs, &BearishRSIJob{
				interval:    interval,
				schedule:    ic.Schedule,
				timeout:     time.Duration(deps.Config.BearishTimeoutMinutes) * time.Minute,
				concurrency: deps.Config.BearishConcurrency,
				preparer:    deps.Preparer,
				usecase:     deps.BearishRSIUC,
				notifier:    deps.Notifier,
				configRepo:  deps.ConfigRepo,
				logger:      deps.Logger,
			})
		}
	}

	return jobs, nil
}
