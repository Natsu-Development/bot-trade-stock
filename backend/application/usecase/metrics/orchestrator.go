package metrics

import (
	"context"
	"time"

	"backend/application/dto"
	"backend/application/port/inbound"
	"backend/application/port/outbound"
	appservice "backend/application/service"
	metricsservice "backend/domain/metrics/service"

	"go.uber.org/zap"
	"golang.org/x/sync/singleflight"
)

// Package metrics owns the all-stock metrics universe via a single UseCase type,
// split across files by responsibility:
//   - orchestrator.go — UseCase type, constructor, public entry points (Refresh,
//     Recompute), and the config-change listener glue
//   - refresh.go — the Layer-1 pipeline internals (sweep + base-metrics build + boot
//     rehydrate) that Refresh drives
//   - screener.go — the screener read path (Filter)
//   - signals_compute.go / alerts_compute.go — the Layer-2 per-config computes
//
// 429 retry is handled at the HTTP transport layer (infrastructure/http.RetryTransport).

var (
	_ inbound.StockMetricsManager  = (*UseCase)(nil)
	_ inbound.ConfigChangeListener = (*UseCase)(nil)
)

// UseCase orchestrates the all-stock metrics: it owns the Layer-1 base pipeline
// (refresh.go) and the screener read path (screener.go), and composes the two Layer-2
// per-config computes (signals for the screener, alerts for the watchlist tick). It
// implements inbound.StockMetricsManager and inbound.ConfigChangeListener.
type UseCase struct {
	gateway        outbound.MarketGateway
	repository     outbound.StockMetricsRepository
	barsRepository outbound.StockBarsRepository
	calculator     *metricsservice.Calculator
	configRepo     outbound.ConfigRepository

	// Concurrency limit for batch fetching.
	concurrency int

	// windowBars is the operator-set bar count (ANALYSIS_WINDOW_BARS), scaled into the
	// daily fetch span for the all-equity metrics batch.
	windowBars int

	// snapshotStore holds the single immutable snapshot (base + ranked + bars + cachedAt),
	// published with ONE atomic swap per refresh and read lock-free by every consumer.
	// This use case is the WRITER; the Layer-2 computes and watchlist job read the SAME
	// store. The Snapshot is immutable after publish (treat as read-only); CachedAt
	// doubles as the identity stamp for Layer-2's LRU freshness check.
	snapshotStore *appservice.SnapshotStore

	// Ensures only one Refresh runs at a time; concurrent callers piggyback.
	refreshGroup singleflight.Group

	// Layer-2 per-config computes:
	//   - signalsCompute resolves the screener's per-config signal flags (Filter calls it).
	//   - alertsCompute publishes the watchlist's alert levels, driven eagerly after each
	//     refresh and on config edit (the tick can't lazily recompute like Filter does).
	signalsCompute *SignalComputeUseCase
	alertsCompute  *AlertComputeUseCase
}

// NewStockMetricsUseCase builds the metrics use case (Layer-1 pipeline + the two Layer-2
// computes), all sharing the one injected SnapshotStore. The package's single constructor.
func NewStockMetricsUseCase(
	gateway outbound.MarketGateway,
	repository outbound.StockMetricsRepository,
	barsRepository outbound.StockBarsRepository,
	configRepo outbound.ConfigRepository,
	concurrency int,
	windowBars int,
	snapshotStore *appservice.SnapshotStore,
	signalsCompute *SignalComputeUseCase,
	alertsCompute *AlertComputeUseCase,
) *UseCase {
	return &UseCase{
		gateway:        gateway,
		repository:     repository,
		barsRepository: barsRepository,
		calculator:     metricsservice.NewCalculator(),
		configRepo:     configRepo,
		concurrency:    concurrency,
		windowBars:     windowBars,
		snapshotStore:  snapshotStore,
		signalsCompute: signalsCompute,
		alertsCompute:  alertsCompute,
	}
}

// OnConfigUpdated (inbound.ConfigChangeListener) recomputes the config's alert trendlines
// on save so the watchlist tick reflects the edit before the daily refresh. The screener
// signal cache needs no explicit bust — its LRU stamp keys on the config's UpdatedAt, so
// the next Compute misses the stale entry on its own.
func (uc *UseCase) OnConfigUpdated(ctx context.Context, configID string) error {
	return uc.alertsCompute.RecomputeForConfig(ctx, configID)
}

// Refresh runs the Layer-1 sweep + base-metrics build (refresh.go), then eagerly
// recomputes per-config alert trendlines for the watchlist tick. The singleflight
// collapses concurrent callers into ONE sweep (followers get the leader's result). The
// eager alert recompute is best-effort (failure logged, never fails the refresh). Driven
// ONLY by the stock-refresh job (boot + daily cron); the HTTP path uses Recompute.
func (uc *UseCase) Refresh(ctx context.Context) (*dto.StockMetricsResult, error) {
	v, err, shared := uc.refreshGroup.Do("refresh", func() (any, error) {
		return uc.refresh(ctx)
	})
	if shared {
		zap.L().Info("Refresh request joined an in-flight run")
	}
	if err != nil {
		return nil, err
	}
	res := v.(*dto.StockMetricsResult)

	if rerr := uc.alertsCompute.RefreshAlertTrendline(ctx); rerr != nil {
		zap.L().Warn("eager alert-trendline recompute failed", zap.Error(rerr))
	}
	return res, nil
}

// Recompute refreshes BOTH per-config caches for configID from the cached snapshot bars
// (NO sweep): the screener SIGNAL cache (signalsCompute.Compute) and the watchlist
// ALERT-trendline cache (alertsCompute.RecomputeForConfig). Signals run FIRST so an
// unknown config_id (ErrConfigNotFound) or unpopulated cache (ErrCacheNotReady)
// short-circuits before alert work; the alert recompute no-ops when bars are still cold.
// Backs POST /stocks/recompute — it doesn't project the snapshot, so it returns the cache
// attributes from GetCacheInfo (the screener read is its sibling Filter).
func (uc *UseCase) Recompute(ctx context.Context, configID string) (cachedAt time.Time, totalStocks int, err error) {
	if _, err = uc.signalsCompute.Compute(ctx, configID); err != nil {
		return time.Time{}, 0, err
	}
	if err = uc.alertsCompute.RecomputeForConfig(ctx, configID); err != nil {
		return time.Time{}, 0, err
	}

	cachedAt, totalStocks, ok := uc.GetCacheInfo()
	if !ok {
		return time.Time{}, 0, inbound.ErrCacheNotReady
	}
	return cachedAt, totalStocks, nil
}
