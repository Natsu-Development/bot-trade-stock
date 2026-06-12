package metrics

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"backend/application/dto"
	"backend/application/port/outbound"
	appservice "backend/application/service"
	metricsagg "backend/domain/metrics/aggregate"
	periodvo "backend/domain/metrics/valueobject"
	marketvo "backend/domain/shared/valueobject/market"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

// This file holds the Layer-1 refresh-job pipeline INTERNALS: the provider sweep +
// base-metrics build the stock-refresh job drives (boot + daily cron), plus the boot
// rehydrate (LoadFromDB). The public Refresh wrapper lives in orchestrator.go; the HTTP
// path never sweeps (it uses orchestrator.go Recompute).

// refresh is the actual refresh implementation. Must only be invoked via the
// singleflight wrapper Refresh (orchestrator.go).
func (uc *UseCase) refresh(ctx context.Context) (*dto.StockMetricsResult, error) {
	startTime := time.Now()
	zap.L().Info("Starting stock metrics refresh for all exchanges")

	// Layer 1 computes config-INDEPENDENT base metrics only (no config, zero signals).
	// All signals + levels are per-config (Layer 2).

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

	listedStocks := len(allStocks)
	zap.L().Info("Listed all stocks from all exchanges", zap.Int("total_stocks", listedStocks))

	// Step 2: Build queries, filtering out non-equity symbols (warrants, bonds, TD-codes).
	queries := make([]marketvo.MarketDataQuery, 0, len(allStocks))
	droppedCount := 0
	for _, stock := range allStocks {
		symbol := string(stock.Symbol)
		if !stock.Symbol.IsEquity() {
			droppedCount++
			continue
		}
		query, err := marketvo.NewMarketDataQuery(symbol, "", "1D", marketvo.FetchSpanForBars(marketvo.Interval1D, uc.windowBars))
		if err != nil {
			zap.L().Warn("Invalid query", zap.String("symbol", symbol), zap.Error(err))
			continue
		}
		queries = append(queries, query)
	}
	if droppedCount > 0 {
		zap.L().Info("Filtered non-equity symbols",
			zap.Int("dropped", droppedCount),
			zap.Int("kept", len(queries)),
		)
	}

	// attemptedStocks reflects the attempted universe so successfully_analyzed +
	// failed_count == total_stocks in the summary.
	attemptedStocks := len(queries)

	// Step 3: Fetch batch (concurrency handled by usecase)
	barData, failedSymbols := uc.fetchBatch(ctx, queries)

	fetchDuration := time.Since(startTime)
	zap.L().Info("Fetched price data for all stocks",
		zap.Int("successful", len(barData)),
		zap.Int("failed", len(failedSymbols)),
		zap.Duration("fetch_duration", fetchDuration),
	)

	// Step 4: Calculate metrics. Index listed stocks by symbol for O(1) exchange/name
	// lookup (barData is keyed by symbol; allStocks is a flat slice).
	stockInfo := make(map[string]marketvo.StockInfo, len(allStocks))
	for _, stock := range allStocks {
		stockInfo[string(stock.Symbol)] = stock
	}

	allMetrics := make([]*metricsagg.StockMetrics, 0, len(barData))
	for symbol, bars := range barData {
		info := stockInfo[symbol]
		metrics := uc.calculator.CalculateBaseMetrics(symbol, string(info.Exchange), info.Name, bars)
		if metrics != nil {
			allMetrics = append(allMetrics, metrics)
		} else {
			failedSymbols[symbol] = fmt.Sprintf("insufficient data: got %d points, need at least %d", len(bars), periodvo.MinDataPoints)
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

	// Step 6b: Persist the raw bars (compressed) stamped with the SAME calculatedAt so
	// a restart can rehydrate them (LoadFromDB) and recompute Layer-2 signals
	// immediately — without a provider sweep. Best-effort: on failure the boot path
	// falls back to empty signals until the next refresh, so it must not fail refresh.
	if err := uc.barsRepository.SaveBars(ctx, barData, calculatedAt); err != nil {
		zap.L().Warn("Failed to persist raw bars; signals will be empty after a restart until the next refresh", zap.Error(err))
	} else {
		zap.L().Info("Raw bars persisted to database", zap.Int("symbol_count", len(barData)))
	}

	// Step 7: Publish the new immutable snapshot (base + ranked + bars + stamp) in ONE
	// atomic swap; consumers read it lock-free. bars retains barData so Layer 2 can
	// recompute per-config signals without re-fetching.
	uc.publishSnapshot(buildMetricsMap(rankedMetrics), rankedMetrics, barData, calculatedAt)

	totalDuration := time.Since(startTime)

	// Step 8: Log detailed summary
	uc.logRefreshSummary(attemptedStocks, len(rankedMetrics), failedSymbols, totalDuration)

	// Counts only: the sole caller (cron StockRefreshJob) logs TotalStocksAnalyzed +
	// CalculatedAt and never reads Stocks, so we skip the per-row projection (Stocks stays
	// nil). Filter builds the per-config rows lazily (screener.go).
	return &dto.StockMetricsResult{
		TotalStocksAnalyzed: attemptedStocks,
		StocksMatching:      len(rankedMetrics),
		CalculatedAt:        calculatedAt,
	}, nil
}

// buildMetricsMap returns a freshly-allocated symbol→metrics lookup table for a
// Snapshot's base field. The map shares the StockMetrics pointers with ranked.
func buildMetricsMap(metrics []*metricsagg.StockMetrics) map[string]*metricsagg.StockMetrics {
	m := make(map[string]*metricsagg.StockMetrics, len(metrics))
	for _, sm := range metrics {
		m[string(sm.Symbol)] = sm
	}
	return m
}

// publishSnapshot atomically swaps in the new snapshot. Publishes are serialized (boot
// LoadFromDB, then singleflight refresh), so each stamps a distinct cachedAt — the
// identity key Layer 2 uses for its LRU freshness check.
func (uc *UseCase) publishSnapshot(
	base map[string]*metricsagg.StockMetrics,
	ranked []*metricsagg.StockMetrics,
	bars map[string][]marketvo.MarketData,
	cachedAt time.Time,
) {
	uc.snapshotStore.Publish(&appservice.Snapshot{
		Base:     base,
		Ranked:   ranked,
		Bars:     bars,
		CachedAt: cachedAt,
	})
}

// LoadFromDB loads persisted stock metrics into the RAM cache at startup. Returns true
// if the cache was populated, false if no data exists.
func (uc *UseCase) LoadFromDB(ctx context.Context) (bool, error) {
	metrics, calculatedAt, err := uc.repository.LoadLatest(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to load stock metrics from database: %w", err)
	}

	if len(metrics) == 0 {
		zap.L().Info("No stock metrics found in database, cache remains empty")
		return false, nil
	}

	// Rehydrate the raw bars persisted alongside these metrics so Layer 2 can recompute
	// per-config signals immediately on boot — no provider sweep. Bars are adopted ONLY
	// when present AND stamped with the SAME calculatedAt as the metrics (Equal, not ==,
	// for monotonic/ms-truncation safety); a mismatch, absence, or decode error leaves
	// bars nil (signals stay empty until the next refresh, the prior safe behavior).
	// Per-config alert levels remain RAM-only and stay empty until that refresh.
	var bars map[string][]marketvo.MarketData
	loadedBars, barsCalculatedAt, berr := uc.barsRepository.LoadBars(ctx)
	if berr != nil {
		zap.L().Warn("Failed to load persisted bars; boot signals empty until next refresh", zap.Error(berr))
	} else if loadedBars != nil && barsCalculatedAt.Equal(calculatedAt) {
		bars = loadedBars
	}

	uc.publishSnapshot(buildMetricsMap(metrics), metrics, bars, calculatedAt)

	zap.L().Info("Stock metrics loaded from database into cache",
		zap.Int("metrics_count", len(metrics)),
		zap.Int("bar_symbol_count", len(bars)),
		zap.Time("calculated_at", calculatedAt),
	)

	return true, nil
}

// logRefreshSummary logs a detailed summary of the refresh process.
func (uc *UseCase) logRefreshSummary(totalStocks, successCount int, failedSymbols map[string]string, duration time.Duration) {
	failedCount := len(failedSymbols)

	failedList := make([]string, 0, len(failedSymbols))
	for symbol, reason := range failedSymbols {
		if !strings.Contains(reason, "insufficient data") {
			failedList = append(failedList, fmt.Sprintf("%s: %s", symbol, reason))
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
func (uc *UseCase) fetchBatch(
	ctx context.Context,
	queries []marketvo.MarketDataQuery,
) (map[string][]marketvo.MarketData, map[string]string) {
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(uc.concurrency)

	barData := make(map[string][]marketvo.MarketData)
	failedSymbols := make(map[string]string)
	var mu sync.Mutex

	for _, query := range queries {
		query := query
		g.Go(func() error {
			bars, err := uc.gateway.FetchData(gctx, query)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				failedSymbols[string(query.Symbol)] = err.Error()
			} else if len(bars) > 0 {
				barData[string(query.Symbol)] = bars
			} else {
				failedSymbols[string(query.Symbol)] = "empty data returned"
			}
			return nil
		})
	}

	g.Wait()
	return barData, failedSymbols
}
