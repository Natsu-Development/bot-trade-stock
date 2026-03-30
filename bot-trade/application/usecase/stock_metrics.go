package usecase

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"bot-trade/application/dto"
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	analysissvc "bot-trade/domain/analysis/service"
	analysisvo "bot-trade/domain/analysis/valueobject"
	configagg "bot-trade/domain/config/aggregate"
	metricsagg "bot-trade/domain/metrics/aggregate"
	metricsservice "bot-trade/domain/metrics/service"
	sharedservice "bot-trade/domain/shared/service"
	filtervo "bot-trade/domain/shared/valueobject/filter"
	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
)

// SignalDaysThreshold defines how many days a signal is considered valid.
// Signals older than this threshold result in false boolean flags.
const SignalDaysThreshold = 50

// Note: Retry logic for rate-limited requests (429) is handled at the HTTP transport layer
// via infrastructure/http.RetryTransport. This keeps the usecase clean and focused on
// business logic while making retry behavior reusable across all HTTP-based gateways.

var _ inbound.StockMetricsManager = (*StockMetricsUseCase)(nil)

// StockMetricsUseCase orchestrates the stock metrics calculation for all stocks.
type StockMetricsUseCase struct {
	gateway    outbound.MarketGateway
	repository outbound.StockMetricsRepository
	calculator *metricsservice.Calculator
	configRepo outbound.ConfigRepository

	// RAM cache
	cachedMetrics []*metricsagg.StockMetrics
	cachedAt      time.Time
	cacheMu       sync.RWMutex
}

// NewStockMetricsUseCase creates a new stock metrics use case.
func NewStockMetricsUseCase(
	gateway outbound.MarketGateway,
	repository outbound.StockMetricsRepository,
	configRepo outbound.ConfigRepository,
) *StockMetricsUseCase {
	return &StockMetricsUseCase{
		gateway:    gateway,
		repository: repository,
		calculator: metricsservice.NewCalculator(),
		configRepo: configRepo,
	}
}

// Refresh fetches ALL stocks from HOSE, HNX, UPCOM, calculates metrics, and caches in RAM.
func (uc *StockMetricsUseCase) Refresh(ctx context.Context) (*dto.StockMetricsResult, error) {
	startTime := time.Now()
	zap.L().Info("Starting stock metrics refresh for all exchanges")

	// Fetch system config for signal computation and data range
	systemConfig, err := uc.configRepo.GetByID(ctx, "system")
	if err != nil {
		zap.L().Warn("System config not found, signal computation will be skipped",
			zap.Error(err),
			zap.String("hint", "Create a config with _id='system' to enable signals"),
		)
	}

	// Step 1: List all stocks (check for optional capability)
	stockLister, ok := uc.gateway.(outbound.StockLister)
	if !ok {
		return nil, fmt.Errorf("gateway does not support listing stocks")
	}
	allStocks, err := stockLister.ListAllStocks(ctx)
	if err != nil {
		zap.L().Error("Failed to list stocks", zap.Error(err))
		return nil, fmt.Errorf("failed to list stocks: %w", err)
	}

	totalStocks := len(allStocks)
	zap.L().Info("Listed all stocks from all exchanges", zap.Int("total_stocks", totalStocks))

	// Step 2: Build queries (usecase logic - no exchange field needed)
	queries := make([]marketvo.MarketDataQuery, 0, len(allStocks))
	for _, stock := range allStocks {
		query, err := marketvo.NewMarketDataQueryFromStrings(string(stock.Symbol), "", "1D", marketvo.LookbackDay(systemConfig.LookbackDay))
		if err != nil {
			zap.L().Warn("Invalid query", zap.String("symbol", string(stock.Symbol)), zap.Error(err))
			continue
		}
		queries = append(queries, query)
	}

	// Step 3: Fetch batch (concurrency handled by usecase)
	successData, failedData := uc.fetchBatch(ctx, queries)

	fetchDuration := time.Since(startTime)
	zap.L().Info("Fetched price data for all stocks",
		zap.Int("successful", len(successData)),
		zap.Int("failed", len(failedData)),
		zap.Duration("fetch_duration", fetchDuration),
	)

	// Step 4: Calculate metrics (usecase logic)
	// Build a lookup map for exchange info
	exchangeLookup := make(map[string]string, len(allStocks))
	for _, stock := range allStocks {
		exchangeLookup[string(stock.Symbol)] = string(stock.Exchange)
	}

	allMetrics := make([]*metricsagg.StockMetrics, 0, len(successData))
	for symbol, data := range successData {
		exchange := exchangeLookup[symbol]
		metrics := uc.calculator.CalculateForStock(symbol, exchange, data)
		if metrics != nil {
			// Compute signals using system config if available
			if systemConfig != nil {
				uc.computeSignals(metrics, data, systemConfig)
			}
			allMetrics = append(allMetrics, metrics)
		} else {
			failedData[symbol] = fmt.Sprintf("insufficient data: got %d points, need at least 21", len(data))
		}
	}

	// Step 5: Rank all stocks using relative position
	rankedMetrics := uc.calculator.RankAll(allMetrics)
	calculatedAt := time.Now()

	// Step 6: Persist to MongoDB
	if err := uc.repository.Save(ctx, rankedMetrics, calculatedAt); err != nil {
		zap.L().Error("Failed to persist stock metrics to database", zap.Error(err))
		// Continue anyway - we still have the data in memory
	} else {
		zap.L().Info("Stock metrics persisted to database",
			zap.Int("metrics_count", len(rankedMetrics)),
		)
	}

	// Step 7: Cache in RAM
	uc.cacheMu.Lock()
	uc.cachedMetrics = rankedMetrics
	uc.cachedAt = calculatedAt
	uc.cacheMu.Unlock()

	totalDuration := time.Since(startTime)

	// Step 8: Log detailed summary
	uc.logRefreshSummary(totalStocks, len(rankedMetrics), failedData, totalDuration)

	// Return full result
	return &dto.StockMetricsResult{
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
// Validation is performed during JSON unmarshaling at the handler layer.
func (uc *StockMetricsUseCase) Filter(ctx context.Context, filter *filtervo.StockFilter) (*dto.StockMetricsResult, error) {
	uc.cacheMu.RLock()
	defer uc.cacheMu.RUnlock()

	if uc.cachedMetrics == nil {
		return nil, inbound.ErrCacheNotReady
	}

	// If no filters, return all
	if filter == nil || len(filter.Conditions) == 0 {
		return &dto.StockMetricsResult{
			TotalStocksAnalyzed: len(uc.cachedMetrics),
			StocksMatching:      len(uc.cachedMetrics),
			CalculatedAt:        uc.cachedAt,
			Stocks:              uc.cachedMetrics,
		}, nil
	}

	// Filter using the domain service
	filtered := make([]*metricsagg.StockMetrics, 0)
	for _, stock := range uc.cachedMetrics {
		if metricsservice.Matches(stock, filter) {
			filtered = append(filtered, stock)
		}
	}

	return &dto.StockMetricsResult{
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
		zap.L().Info("No stock metrics found in database, cache remains empty")
		return false, nil
	}

	uc.cacheMu.Lock()
	uc.cachedMetrics = metrics
	uc.cachedAt = calculatedAt
	uc.cacheMu.Unlock()

	zap.L().Info("Stock metrics loaded from database into cache",
		zap.Int("metrics_count", len(metrics)),
		zap.Time("calculated_at", calculatedAt),
	)

	return true, nil
}

// logRefreshSummary logs a detailed summary of the refresh process.
func (uc *StockMetricsUseCase) logRefreshSummary(totalStocks, successCount int, failedSymbols map[string]string, duration time.Duration) {
	failedCount := len(failedSymbols)

	failedList := make([]string, 0, len(failedSymbols))
	for sym, reason := range failedSymbols {
		if !strings.Contains(reason, "insufficient data") {
			failedList = append(failedList, fmt.Sprintf("%s: %s", sym, reason))
		}
	}

	zap.L().Info("========== STOCK METRICS REFRESH SUMMARY ==========")
	zap.L().Info("Refresh completed",
		zap.Int("total_stocks", totalStocks),
		zap.Int("successfully_analyzed", successCount),
		zap.Int("failed_count", failedCount),
		zap.Duration("total_duration", duration),
	)

	if failedCount > 0 {
		zap.L().Warn("Failed stocks",
			zap.Int("total_failed", failedCount),
			zap.Strings("failed_samples", failedList),
		)
	}

	zap.L().Info("====================================================")
}

// fetchBatch concurrently fetches data for multiple queries using the provided gateway.
func (uc *StockMetricsUseCase) fetchBatch(
	ctx context.Context,
	queries []marketvo.MarketDataQuery,
) (map[string][]marketvo.MarketData, map[string]string) {
	successData := make(map[string][]marketvo.MarketData)
	failedData := make(map[string]string)
	var mu sync.Mutex

	var wg sync.WaitGroup
	for _, query := range queries {
		wg.Add(1)
		go func(q marketvo.MarketDataQuery) {
			defer wg.Done()
			data, err := uc.gateway.FetchData(ctx, q)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				failedData[string(q.Symbol)] = err.Error()
			} else if len(data) > 0 {
				successData[string(q.Symbol)] = data
			} else {
				failedData[string(q.Symbol)] = "empty data returned"
			}
		}(query)
	}

	wg.Wait()
	return successData, failedData
}

// computeSignals populates signal fields using analysis domain services.
func (uc *StockMetricsUseCase) computeSignals(
	metrics *metricsagg.StockMetrics,
	priceHistory []marketvo.MarketData,
	cfg *configagg.TradingConfig,
) {
	rsiPeriod := int(cfg.RSIPeriod)
	pivotPeriod := int(cfg.PivotPeriod)
	indicesRecent := int(cfg.IndicesRecent)
	proximityPct := cfg.Trendline.ProximityDecimal()
	rangeMin := cfg.Divergence.RangeMin
	rangeMax := cfg.Divergence.RangeMax
	maxLines := cfg.Trendline.MaxLines
	signalThreshold := time.Now().AddDate(0, 0, -SignalDaysThreshold)

	if len(priceHistory) < rsiPeriod+1 {
		return
	}

	// 1. Calculate RSI
	dataWithRSI := sharedservice.CalculateRSI(priceHistory, rsiPeriod)
	if len(dataWithRSI) < indicesRecent {
		return
	}

	// 2. Slice recent data
	startIndex := len(dataWithRSI) - indicesRecent
	recentData := dataWithRSI[startIndex:]

	// 3. Find pivots
	// RSI pivots for divergence detection (must use FieldRSI)
	rsiHighPivots := analysissvc.FindHighPivots(recentData, analysisvo.FieldRSI, pivotPeriod)
	rsiLowPivots := analysissvc.FindLowPivots(recentData, analysisvo.FieldRSI, pivotPeriod)
	// Price pivots for trendline building (uses FieldHigh/FieldLow)
	priceHighPivots := analysissvc.FindHighPivots(recentData, analysisvo.FieldHigh, pivotPeriod)
	priceLowPivots := analysissvc.FindLowPivots(recentData, analysisvo.FieldLow, pivotPeriod)

	// 4. Detect divergences using config values
	bullishDivergences := analysissvc.FindBullishDivergences(rsiLowPivots, rangeMin, rangeMax)
	bearishDivergences := analysissvc.FindBearishDivergences(rsiHighPivots, rangeMin, rangeMax)

	// Check divergence dates - use second pivot date (most recent point)
	if len(bullishDivergences) > 0 {
		latestDiv := bullishDivergences[0]
		if isSignalWithinDays(latestDiv.SecondPivot.Date, signalThreshold) {
			metrics.HasBullishRSI = true
		}
	}

	if len(bearishDivergences) > 0 {
		latestDiv := bearishDivergences[0]
		if isSignalWithinDays(latestDiv.SecondPivot.Date, signalThreshold) {
			metrics.HasBearishRSI = true
		}
	}

	// 5. Build trendlines using config maxLines
	supportTrendlines := analysissvc.BuildSupportTrendlines(priceLowPivots, maxLines)
	resistanceTrendlines := analysissvc.BuildResistanceTrendlines(priceHighPivots, maxLines)

	// 6. Generate signals
	breakdownSignals := analysissvc.GenerateSupportSignals(supportTrendlines, recentData, proximityPct)
	breakoutSignals := analysissvc.GenerateResistanceSignals(resistanceTrendlines, recentData, proximityPct)

	// 7. Extract signal types with date threshold check
	for _, s := range breakdownSignals {
		if isSignalWithinDays(s.Time, signalThreshold) {
			switch s.Type {
			case analysisvo.BreakdownPotential:
				metrics.HasBreakdownPotential = true
			case analysisvo.BreakdownConfirmed:
				metrics.HasBreakdownConfirmed = true
			}
		}
	}

	for _, s := range breakoutSignals {
		if isSignalWithinDays(s.Time, signalThreshold) {
			switch s.Type {
			case analysisvo.BreakoutPotential:
				metrics.HasBreakoutPotential = true
			case analysisvo.BreakoutConfirmed:
				metrics.HasBreakoutConfirmed = true
			}
		}
	}
}

// isSignalWithinDays checks if a date string (YYYY-MM-DD) is within threshold.
func isSignalWithinDays(dateStr string, threshold time.Time) bool {
	if dateStr == "" {
		return false
	}
	signalDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return false
	}
	return signalDate.After(threshold) || signalDate.Equal(threshold)
}
