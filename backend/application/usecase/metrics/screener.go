package metrics

import (
	"context"
	"time"

	"backend/application/dto"
	"backend/application/port/inbound"
	analysisvo "backend/domain/analysis/valueobject"
	metricsagg "backend/domain/metrics/aggregate"
	metricsservice "backend/domain/metrics/service"
	filtervo "backend/domain/shared/valueobject/filter"
)

// This file holds the screener read path over the published snapshot: Filter (+ its
// screenerStock builder) and GetCacheInfo. These never fetch — they read the lock-free
// snapshot refresh.go publishes.

// Filter returns the cached metrics matching the AND/OR/NOT filter for the given config
// — the screener READ path behind POST /stocks/filter. It resolves the per-config
// signals (SignalComputeUseCase.Compute), reads the snapshot, then filters + projects
// each survivor into a ScreenerStock with its flags spliced on (the shared entry is
// never mutated). Unknown configID → ErrConfigNotFound; unpopulated cache →
// ErrCacheNotReady; a nil/empty filter returns the full view. The recompute/warm path is
// its sibling Recompute (orchestrator.go).
func (uc *UseCase) Filter(ctx context.Context, filter *filtervo.StockFilter, configID string) (*dto.StockMetricsResult, error) {
	signals, err := uc.signalsCompute.Compute(ctx, configID)
	if err != nil {
		return nil, err
	}

	snap := uc.snapshotStore.Load()
	if snap == nil {
		return nil, inbound.ErrCacheNotReady
	}

	// Loop-invariant filter-active test hoisted out: a nil/empty filter projects every
	// ranked stock; otherwise Matches gates each.
	applyFilter := filter != nil && !filter.IsEmpty()
	out := make([]*dto.ScreenerStock, 0, len(snap.Ranked))
	for _, stock := range snap.Ranked {
		if applyFilter && !metricsservice.Matches(stock, filter, signals) {
			continue
		}
		out = append(out, screenerStock(stock, signals))
	}

	return &dto.StockMetricsResult{
		TotalStocksAnalyzed: len(snap.Ranked),
		StocksMatching:      len(out),
		CalculatedAt:        snap.CachedAt,
		Stocks:              out,
	}, nil
}

// screenerStock builds one ScreenerStock: the shared base metric (not copied) plus the
// six per-config signal flags. A nil map or absent symbol yields zero flags.
func screenerStock(stock *metricsagg.StockMetrics, signalsBySymbol map[string]analysisvo.SignalFlags) *dto.ScreenerStock {
	sig := signalsBySymbol[string(stock.Symbol)] // zero Signals when nil map or symbol absent
	return &dto.ScreenerStock{
		StockMetrics:          stock,
		HasBreakoutPotential:  sig.HasBreakoutPotential,
		HasBreakoutConfirmed:  sig.HasBreakoutConfirmed,
		HasBreakdownPotential: sig.HasBreakdownPotential,
		HasBreakdownConfirmed: sig.HasBreakdownConfirmed,
		HasBullishRSI:         sig.HasBullishRSI,
		HasBearishRSI:         sig.HasBearishRSI,
	}
}

// GetCacheInfo returns information about the current cache state.
func (uc *UseCase) GetCacheInfo() (cachedAt time.Time, totalStocks int, ok bool) {
	snap := uc.snapshotStore.Load()
	if snap == nil {
		return time.Time{}, 0, false
	}
	return snap.CachedAt, len(snap.Ranked), true
}
