package analyze

import (
	"context"
	"fmt"
	"time"

	"bot-trade/application/dto"
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	appPrep "bot-trade/application/usecase/analyze/prep"
	configagg "bot-trade/domain/config/aggregate"
	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

// SymbolSelector selects which symbols to analyze from a config.
type SymbolSelector func(cfg *configagg.TradingConfig) []marketvo.Symbol

// AnalyzeFunc performs analysis on prepared data and returns a message if there's a signal.
// Returns empty Message{} if no signal, or error on failure.
type AnalyzeFunc func(ctx context.Context, data *appPrep.DataPrepare, interval string) (outbound.Message, error)

// AnalysisJob is a generic job that analyzes symbols using a strategy function.
type AnalysisJob struct {
	interval      string
	schedule      string
	timeout       time.Duration
	concurrency   int
	namePrefix    string
	preparer      *appPrep.Preparer
	configRepo    outbound.ConfigRepository
	notifier      outbound.Notifier
	selectSymbols SymbolSelector
	analyze       AnalyzeFunc
}

func (j *AnalysisJob) Metadata() inbound.JobMetadata {
	return inbound.JobMetadata{
		Name:        j.namePrefix + "-" + j.interval,
		Schedule:    j.schedule,
		Timeout:     j.timeout,
		Concurrency: j.concurrency,
	}
}

func (j *AnalysisJob) Execute(ctx context.Context) error {
	configs, err := j.configRepo.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("load configs: %w", err)
	}

	for _, cfg := range configs {
		j.processConfig(ctx, cfg)
	}
	return nil
}

func (j *AnalysisJob) processConfig(ctx context.Context, cfg *configagg.TradingConfig) {
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(j.concurrency)

	for _, symbol := range j.selectSymbols(cfg) {
		symbol := symbol
		g.Go(func() error {
			j.analyzeSymbol(gctx, string(symbol), cfg)
			return nil
		})
	}
	g.Wait()
}

func (j *AnalysisJob) analyzeSymbol(ctx context.Context, symbol string, cfg *configagg.TradingConfig) {
	query, err := marketvo.NewMarketDataQueryFromStrings(symbol, "", j.interval, cfg.LookbackDay)
	if err != nil {
		zap.L().Error("Failed to create query", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	data, err := j.preparer.Prepare(ctx, query, string(cfg.ID))
	if err != nil {
		zap.L().Error("Failed to prepare data", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	msg, err := j.analyze(ctx, data, j.interval)
	if err != nil {
		zap.L().Error("Analysis failed", zap.String("symbol", symbol), zap.Error(err))
		return
	}

	if msg.Title == "" {
		return
	}

	if err := j.notifier.Send(ctx, cfg.Telegram, msg); err != nil {
		zap.L().Error("Failed to send notification", zap.String("symbol", symbol), zap.Error(err))
	}
}

// FilterSignals filters signals by allowed types.
func FilterSignals(signals []dto.SignalDTO, allowedTypes []string) []dto.SignalDTO {
	var filtered []dto.SignalDTO
	for _, s := range signals {
		for _, t := range allowedTypes {
			if s.Type == t {
				filtered = append(filtered, s)
				break
			}
		}
	}
	return filtered
}

// SelectBearishSymbols returns bearish watchlist symbols.
func SelectBearishSymbols(cfg *configagg.TradingConfig) []marketvo.Symbol {
	return cfg.BearishSymbols
}

// SelectBullishSymbols returns bullish watchlist symbols.
func SelectBullishSymbols(cfg *configagg.TradingConfig) []marketvo.Symbol {
	return cfg.BullishSymbols
}
