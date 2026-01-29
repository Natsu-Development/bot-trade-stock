package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/aggregate/stockmetrics"
	metricsService "bot-trade/domain/service/stockmetrics"
	infraPort "bot-trade/infrastructure/port"

	"go.uber.org/zap"
)

// Note: Retry logic for rate-limited requests (429) is handled at the HTTP transport layer
// via infrastructure/http.RetryTransport. This keeps the usecase clean and focused on
// business logic while making retry behavior reusable across all HTTP-based gateways.

// supportedExchanges defines the Vietnamese stock exchanges to analyze.
var supportedExchanges = []string{"HOSE", "HNX", "UPCOM"}

// ErrCacheNotReady is returned when the cache has not been populated yet.
var ErrCacheNotReady = errors.New("stock metrics cache not ready, call Refresh first")

// StockMetricsUseCase orchestrates the stock metrics calculation for all stocks.
type StockMetricsUseCase struct {
	marketDataGateway infraPort.MarketDataGateway
	repository        infraPort.StockMetricsRepository
	calculator        *metricsService.Calculator
	logger            *zap.Logger

	// RAM cache
	cachedMetrics []*stockmetrics.StockMetrics
	cachedAt      time.Time
	cacheMu       sync.RWMutex
}

// NewStockMetricsUseCase creates a new stock metrics use case.
func NewStockMetricsUseCase(
	marketDataGateway infraPort.MarketDataGateway,
	repository infraPort.StockMetricsRepository,
	logger *zap.Logger,
) *StockMetricsUseCase {
	return &StockMetricsUseCase{
		marketDataGateway: marketDataGateway,
		repository:        repository,
		calculator:        metricsService.NewCalculator(),
		logger:            logger,
	}
}

// Refresh fetches ALL stocks from HOSE, HNX, UPCOM, calculates metrics, and caches in RAM.
func (uc *StockMetricsUseCase) Refresh(ctx context.Context) (*stockmetrics.StockMetricsResult, error) {
	startTime := time.Now()
	uc.logger.Info("Starting stock metrics refresh for all exchanges",
		zap.Strings("exchanges", supportedExchanges),
	)

	// Step 1: Fetch stocks from all exchanges concurrently
	allStocks, exchangeStats, err := uc.fetchAllExchangeStocks(ctx)
	if err != nil {
		uc.logger.Error("Failed to list stocks from exchanges", zap.Error(err))
		return nil, fmt.Errorf("failed to list stocks: %w", err)
	}

	totalStocks := len(allStocks)
	uc.logger.Info("Listed all stocks from all exchanges",
		zap.Int("total_stocks", totalStocks),
		zap.Any("exchange_stats", exchangeStats),
	)

	// Calculate date range for 252 trading days
	endDate := time.Now().Format("2006-01-02")
	startDate := time.Now().AddDate(0, 0, -400).Format("2006-01-02") // 400 days back

	// Step 2: Fetch price history for each stock concurrently with retry and failure tracking
	var (
		allMetrics    = make([]*stockmetrics.StockMetrics, 0, len(allStocks))
		failedSymbols = make(map[string]string) // symbol -> error reason
		mu            sync.Mutex
		wg            sync.WaitGroup
		semaphore     = make(chan struct{}, 10) // Limit concurrent requests
	)

	for _, stock := range allStocks {
		wg.Add(1)
		go func(sym, exchange string) {
			defer wg.Done()

			// Acquire semaphore
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			metrics, fetchErr := uc.fetchAndCalculate(ctx, sym, exchange, startDate, endDate)

			mu.Lock()
			if fetchErr != nil {
				failedSymbols[sym] = fetchErr.Error()
			} else if metrics != nil {
				allMetrics = append(allMetrics, metrics)
			}
			mu.Unlock()
		}(stock.Symbol, stock.Exchange)
	}

	wg.Wait()

	fetchDuration := time.Since(startTime)
	uc.logger.Info("Fetched price data for all stocks",
		zap.Int("successful", len(allMetrics)),
		zap.Int("failed", len(failedSymbols)),
		zap.Duration("fetch_duration", fetchDuration),
	)

	// Step 3: Rank all stocks using relative position
	rankedMetrics := uc.calculator.RankAll(allMetrics)
	calculatedAt := time.Now()

	// Step 4: Persist to MongoDB
	if err := uc.repository.Save(ctx, rankedMetrics, calculatedAt); err != nil {
		uc.logger.Error("Failed to persist stock metrics to database", zap.Error(err))
		// Continue anyway - we still have the data in memory
	} else {
		uc.logger.Info("Stock metrics persisted to database",
			zap.Int("metrics_count", len(rankedMetrics)),
		)
	}

	// Step 5: Cache in RAM
	uc.cacheMu.Lock()
	uc.cachedMetrics = rankedMetrics
	uc.cachedAt = calculatedAt
	uc.cacheMu.Unlock()

	totalDuration := time.Since(startTime)

	// Step 6: Log detailed summary
	uc.logRefreshSummary(totalStocks, len(rankedMetrics), failedSymbols, totalDuration)

	// Return full result
	return &stockmetrics.StockMetricsResult{
		TotalStocksAnalyzed: totalStocks,
		StocksMatching:      len(rankedMetrics),
		CalculatedAt:        uc.cachedAt,
		Stocks:              rankedMetrics,
	}, nil
}

// Filter returns cached stock metrics filtered by advanced filter conditions.
// Supports AND/OR logic for combining multiple filter conditions.
// Available fields: rs_1m, rs_3m, rs_6m, rs_9m, rs_52w, volume_vs_sma, current_volume, volume_sma20
// Available operators: >=, <=, >, <, =
func (uc *StockMetricsUseCase) Filter(ctx context.Context, filterReq *stockmetrics.FilterRequest) (*stockmetrics.StockMetricsResult, error) {
	uc.cacheMu.RLock()
	defer uc.cacheMu.RUnlock()

	if uc.cachedMetrics == nil {
		return nil, ErrCacheNotReady
	}

	// If no filters, return all
	if filterReq == nil || len(filterReq.Conditions) == 0 {
		return &stockmetrics.StockMetricsResult{
			TotalStocksAnalyzed: len(uc.cachedMetrics),
			StocksMatching:      len(uc.cachedMetrics),
			CalculatedAt:        uc.cachedAt,
			Stocks:              uc.cachedMetrics,
		}, nil
	}

	// Filter cached metrics using advanced filter
	filtered := make([]*stockmetrics.StockMetrics, 0)
	for _, s := range uc.cachedMetrics {
		if s.MatchesFilter(filterReq) {
			filtered = append(filtered, s)
		}
	}

	return &stockmetrics.StockMetricsResult{
		TotalStocksAnalyzed: len(uc.cachedMetrics),
		StocksMatching:      len(filtered),
		CalculatedAt:        uc.cachedAt,
		Stocks:              filtered,
	}, nil
}

// GetCacheInfo returns information about the current cache state.
func (uc *StockMetricsUseCase) GetCacheInfo() (cachedAt time.Time, totalStocks int, ok bool) {
	uc.cacheMu.RLock()
	defer uc.cacheMu.RUnlock()

	if uc.cachedMetrics == nil {
		return time.Time{}, 0, false
	}
	return uc.cachedAt, len(uc.cachedMetrics), true
}

// LoadFromDB loads persisted stock metrics from database into RAM cache.
// Should be called on application startup to pre-populate the cache.
// Returns true if cache was populated, false if no data exists.
func (uc *StockMetricsUseCase) LoadFromDB(ctx context.Context) (bool, error) {
	metrics, calculatedAt, err := uc.repository.LoadLatest(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to load stock metrics from database: %w", err)
	}

	if len(metrics) == 0 {
		uc.logger.Info("No stock metrics found in database, cache remains empty")
		return false, nil
	}

	uc.cacheMu.Lock()
	uc.cachedMetrics = metrics
	uc.cachedAt = calculatedAt
	uc.cacheMu.Unlock()

	uc.logger.Info("Stock metrics loaded from database into cache",
		zap.Int("metrics_count", len(metrics)),
		zap.Time("calculated_at", calculatedAt),
	)

	return true, nil
}

// fetchAndCalculate fetches price history and calculates metrics for a single stock.
func (uc *StockMetricsUseCase) fetchAndCalculate(ctx context.Context, symbol, exchange, startDate, endDate string) (*stockmetrics.StockMetrics, error) {
	query, err := market.NewMarketDataQueryFromStrings(symbol, startDate, endDate, "1D")
	if err != nil {
		return nil, fmt.Errorf("invalid query: %w", err)
	}

	response, err := uc.marketDataGateway.FetchStockData(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("fetch failed: %w", err)
	}

	if len(response.PriceHistory) == 0 {
		return nil, nil // No price history available
	}

	// Calculate metrics for this stock (returns nil if insufficient data)
	metrics := uc.calculator.CalculateForStock(symbol, exchange, response.PriceHistory)

	if metrics != nil {
		uc.logger.Debug("Calculated metrics for stock",
			zap.String("symbol", symbol),
			zap.String("exchange", exchange),
			zap.Int("data_points", len(response.PriceHistory)),
		)
	}

	return metrics, nil
}

// logRefreshSummary logs a detailed summary of the refresh process.
func (uc *StockMetricsUseCase) logRefreshSummary(totalStocks, successCount int, failedSymbols map[string]string, duration time.Duration) {
	failedCount := len(failedSymbols)

	// Build failed stocks summary (limit to first 20 for readability)
	failedList := make([]string, 0, len(failedSymbols))
	for sym, reason := range failedSymbols {
		if len(failedList) < 20 {
			failedList = append(failedList, fmt.Sprintf("%s: %s", sym, reason))
		}
	}

	uc.logger.Info("========== STOCK METRICS REFRESH SUMMARY ==========")
	uc.logger.Info("Refresh completed",
		zap.Int("total_stocks", totalStocks),
		zap.Int("successfully_analyzed", successCount),
		zap.Int("failed_count", failedCount),
		zap.Duration("total_duration", duration),
	)

	if failedCount > 0 {
		uc.logger.Warn("Failed stocks",
			zap.Int("total_failed", failedCount),
			zap.Strings("failed_samples", failedList),
		)

		if failedCount > 20 {
			uc.logger.Warn("Additional failed stocks not shown",
				zap.Int("hidden_count", failedCount-20),
			)
		}
	}

	uc.logger.Info("====================================================")
}

// fetchAllExchangeStocks fetches stocks from all supported exchanges concurrently.
// Returns combined stock list and per-exchange statistics.
func (uc *StockMetricsUseCase) fetchAllExchangeStocks(ctx context.Context) ([]market.StockInfo, map[string]int, error) {
	type exchangeResult struct {
		exchange string
		stocks   []market.StockInfo
		err      error
	}

	resultCh := make(chan exchangeResult, len(supportedExchanges))

	// Fetch from all exchanges concurrently
	for _, exchange := range supportedExchanges {
		go func(ex string) {
			resp, err := uc.marketDataGateway.ListAllStocks(ctx, ex)
			if err != nil {
				resultCh <- exchangeResult{exchange: ex, err: err}
				return
			}
			resultCh <- exchangeResult{exchange: ex, stocks: resp.Stocks}
		}(exchange)
	}

	// Collect results
	var allStocks []market.StockInfo
	exchangeStats := make(map[string]int)
	var errors []string

	for i := 0; i < len(supportedExchanges); i++ {
		result := <-resultCh
		if result.err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", result.exchange, result.err))
			uc.logger.Error("Failed to fetch stocks from exchange",
				zap.String("exchange", result.exchange),
				zap.Error(result.err),
			)
			continue
		}

		allStocks = append(allStocks, result.stocks...)
		exchangeStats[result.exchange] = len(result.stocks)

		uc.logger.Info("Fetched stocks from exchange",
			zap.String("exchange", result.exchange),
			zap.Int("count", len(result.stocks)),
		)
	}

	// If all exchanges failed, return error
	if len(errors) == len(supportedExchanges) {
		return nil, nil, fmt.Errorf("all exchanges failed: %s", strings.Join(errors, "; "))
	}

	return allStocks, exchangeStats, nil
}
