package service

import (
	"context"
	"sync"
	"time"

	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
	infraPort "bot-trade/infrastructure/port"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

// BaseCronScheduler provides shared utilities for cron schedulers.
type BaseCronScheduler struct {
	cron              *cron.Cron
	logger            *zap.Logger
	notifier          infraPort.Notifier
	predefinedSymbols []string
	isRunning         bool
	mu                sync.RWMutex
	divergenceType    analysis.DivergenceType
	startDateOffset   int
}

// NewBaseCronScheduler creates a new base cron scheduler.
func NewBaseCronScheduler(
	logger *zap.Logger,
	notifier infraPort.Notifier,
	symbols []string,
	divergenceType analysis.DivergenceType,
	startDateOffset int,
) *BaseCronScheduler {
	return &BaseCronScheduler{
		cron:              cron.New(cron.WithLocation(time.UTC)),
		logger:            logger,
		notifier:          notifier,
		predefinedSymbols: symbols,
		isRunning:         false,
		divergenceType:    divergenceType,
		startDateOffset:   startDateOffset,
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

// UpdateSymbols updates the predefined symbols list.
func (bcs *BaseCronScheduler) UpdateSymbols(symbols []string) {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()
	bcs.predefinedSymbols = symbols
	bcs.logger.Info("Updated symbols", zap.Int("count", len(symbols)))
}

// GetSymbols returns the current list of symbols.
func (bcs *BaseCronScheduler) GetSymbols() []string {
	bcs.mu.RLock()
	defer bcs.mu.RUnlock()
	return bcs.predefinedSymbols
}

// GetCron returns the underlying cron scheduler.
func (bcs *BaseCronScheduler) GetCron() *cron.Cron {
	return bcs.cron
}

// GetLogger returns the logger.
func (bcs *BaseCronScheduler) GetLogger() *zap.Logger {
	return bcs.logger
}

// GetDivergenceType returns the divergence type.
func (bcs *BaseCronScheduler) GetDivergenceType() analysis.DivergenceType {
	return bcs.divergenceType
}

// GetStartDateOffset returns the start date offset.
func (bcs *BaseCronScheduler) GetStartDateOffset() int {
	return bcs.startDateOffset
}

// SetRunning sets the running state.
func (bcs *BaseCronScheduler) SetRunning(running bool) {
	bcs.mu.Lock()
	defer bcs.mu.Unlock()
	bcs.isRunning = running
}

// CreateMarketDataQuery creates a domain query for market data.
func (bcs *BaseCronScheduler) CreateMarketDataQuery(symbol, startDate, endDate, interval string) (market.MarketDataQuery, error) {
	return market.NewMarketDataQueryFromStrings(symbol, startDate, endDate, interval)
}

// CalculateDateRange calculates the date range based on offset.
func (bcs *BaseCronScheduler) CalculateDateRange() (string, string) {
	endDate := time.Now().Format("2006-01-02")
	startDate := time.Now().AddDate(0, 0, -bcs.startDateOffset).Format("2006-01-02")
	return startDate, endDate
}

// CreateAnalysisContext creates a context with timeout for analysis operations.
func (bcs *BaseCronScheduler) CreateAnalysisContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 10*time.Minute)
}

// ProcessSymbolsConcurrently processes symbols concurrently and returns results.
func (bcs *BaseCronScheduler) ProcessSymbolsConcurrently(
	ctx context.Context,
	symbols []string,
	processFunc func(context.Context, string) (*analysis.AnalysisResult, error),
) (map[string]*analysis.AnalysisResult, map[string]error) {
	results := make(map[string]*analysis.AnalysisResult)
	errors := make(map[string]error)

	var wg sync.WaitGroup
	resultChan := make(chan struct {
		symbol string
		result *analysis.AnalysisResult
		err    error
	}, len(symbols))

	for _, symbol := range symbols {
		wg.Add(1)
		go func(sym string) {
			defer wg.Done()
			result, err := processFunc(ctx, sym)
			resultChan <- struct {
				symbol string
				result *analysis.AnalysisResult
				err    error
			}{sym, result, err}
		}(symbol)
	}

	go func() {
		wg.Wait()
		close(resultChan)
	}()

	for result := range resultChan {
		if result.err != nil {
			errors[result.symbol] = result.err
			bcs.logger.Error("Analysis failed",
				zap.String("symbol", result.symbol),
				zap.Error(result.err),
			)
		} else {
			results[result.symbol] = result.result
		}
	}

	return results, errors
}

// HandleResult delegates result handling to the notifier.
func (bcs *BaseCronScheduler) HandleResult(interval, symbol string, result *analysis.AnalysisResult) {
	if bcs.notifier != nil {
		if err := bcs.notifier.HandleDivergenceResult(bcs.divergenceType, interval, symbol, result); err != nil {
			bcs.logger.Error("Failed to send notification",
				zap.String("type", bcs.divergenceType.String()),
				zap.String("symbol", symbol),
				zap.String("interval", interval),
				zap.Error(err),
			)
		}
	}
}
