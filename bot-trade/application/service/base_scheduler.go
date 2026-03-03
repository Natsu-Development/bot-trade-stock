package service

import (
	"context"
	"sync"
	"time"

	appPort "bot-trade/application/port"
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/config"
	"bot-trade/domain/aggregate/market"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

// analysisContextTimeout is the maximum time allowed for a single scheduled analysis run.
const analysisContextTimeout = 10 * time.Minute

// BaseCronScheduler provides shared utilities for cron schedulers.
type BaseCronScheduler struct {
	cron             *cron.Cron
	logger           *zap.Logger
	notifier         appPort.Notifier
	configRepository appPort.ConfigRepository
	isRunning        bool
	mu               sync.RWMutex
	divergenceType   analysis.DivergenceType
}

// NewBaseCronScheduler creates a new base cron scheduler.
func NewBaseCronScheduler(
	logger *zap.Logger,
	notifier appPort.Notifier,
	configRepository appPort.ConfigRepository,
	divergenceType analysis.DivergenceType,
) *BaseCronScheduler {
	return &BaseCronScheduler{
		cron:             cron.New(cron.WithLocation(time.UTC)),
		logger:           logger,
		notifier:         notifier,
		configRepository: configRepository,
		isRunning:        false,
		divergenceType:   divergenceType,
	}
}

// Stop stops the cron scheduler.
func (bcs *BaseCronScheduler) Stop() {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()

	if bcs.isRunning {
		bcs.cron.Stop()
		bcs.isRunning = false
		bcs.logger.Info("Cron scheduler stopped", zap.String("type", bcs.divergenceType.String()))
	}
}

// IsRunning returns whether the scheduler is running.
func (bcs *BaseCronScheduler) IsRunning() bool {
	bcs.mu.RLock()
	defer bcs.mu.RUnlock()
	return bcs.isRunning
}

// setRunning sets the running state (internal use).
func (bcs *BaseCronScheduler) setRunning(running bool) {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()
	bcs.isRunning = running
}

// LoadAllConfigs loads all trading configurations from repository.
func (bcs *BaseCronScheduler) LoadAllConfigs(ctx context.Context) ([]*config.TradingConfig, error) {
	return bcs.configRepository.GetAll(ctx)
}

// CreateMarketDataQuery creates a domain query for market data.
func (bcs *BaseCronScheduler) CreateMarketDataQuery(symbol, startDate, endDate, interval string) (market.MarketDataQuery, error) {
	return market.NewMarketDataQueryFromStrings(symbol, startDate, endDate, interval)
}

// CalculateDateRange calculates the date range based on offset.
func (bcs *BaseCronScheduler) CalculateDateRange(startDateOffset int) (string, string) {
	endDate := time.Now().Format("2006-01-02")
	startDate := time.Now().AddDate(0, 0, -startDateOffset).Format("2006-01-02")
	return startDate, endDate
}

// CreateAnalysisContext creates a context with timeout for analysis operations.
func (bcs *BaseCronScheduler) CreateAnalysisContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), analysisContextTimeout)
}

// itemResult holds the outcome of processing a single item concurrently.
type itemResult[T any] struct {
	key    string
	result *T
	err    error
}

// ProcessItemsConcurrently processes items concurrently by key and returns results.
// This is a generic function that can be reused across different scheduler types.
func ProcessItemsConcurrently[T any](
	ctx context.Context,
	items []string,
	processFunc func(context.Context, string) (*T, error),
	logger *zap.Logger,
) (map[string]*T, map[string]error) {
	results := make(map[string]*T)
	errs := make(map[string]error)

	var wg sync.WaitGroup
	ch := make(chan itemResult[T], len(items))

	for _, item := range items {
		wg.Add(1)
		go func(key string) {
			defer wg.Done()
			result, err := processFunc(ctx, key)
			ch <- itemResult[T]{key: key, result: result, err: err}
		}(item)
	}

	go func() {
		wg.Wait()
		close(ch)
	}()

	for r := range ch {
		if r.err != nil {
			errs[r.key] = r.err
			logger.Error("Processing failed",
				zap.String("key", r.key),
				zap.Error(r.err),
			)
		} else {
			results[r.key] = r.result
		}
	}

	return results, errs
}

// HandleResult delegates result handling to the notifier.
func (bcs *BaseCronScheduler) HandleResult(interval, symbol string, result *analysis.AnalysisResult, tradingConfig *config.TradingConfig) {
	if bcs.notifier != nil && tradingConfig.Telegram.Enabled {
		if err := bcs.notifier.HandleDivergenceResult(
			bcs.divergenceType, interval, symbol, result,
			tradingConfig.Telegram.BotToken, tradingConfig.Telegram.ChatID,
		); err != nil {
			bcs.logger.Error("Failed to send notification",
				zap.String("type", bcs.divergenceType.String()),
				zap.String("symbol", symbol),
				zap.String("interval", interval),
				zap.Error(err),
			)
		}
	}
}
