package metrics

import (
	"context"
	"fmt"
	"runtime"

	"backend/application/port/outbound"
	appservice "backend/application/service"
	analysissvc "backend/domain/analysis/service"
	analysisvo "backend/domain/analysis/valueobject"
	configagg "backend/domain/config/aggregate"
	marketvo "backend/domain/shared/valueobject/market"

	"golang.org/x/sync/errgroup"
)

// AlertComputeUseCase computes per-config watchlist AlertTrendline (resistance/support)
// over the shared snapshot bars and publishes them to the lock-free AlertTrendlineStore
// the watchlist tick reads. RAM-only: after a restart a config's levels are absent until
// the next refresh's eager publish (or a config edit) recomputes them.
type AlertComputeUseCase struct {
	snapshots      *appservice.SnapshotStore
	configRepo     outbound.ConfigRepository
	trendlineStore *appservice.AlertTrendlineStore
}

// NewAlertComputeUseCase builds the watchlist alert-levels use case: snapshots is the
// shared bars source; trendlineStore is the lock-free per-config alert-level store the
// watchlist tick reads.
func NewAlertComputeUseCase(
	snapshots *appservice.SnapshotStore,
	configRepo outbound.ConfigRepository,
	trendlineStore *appservice.AlertTrendlineStore,
) *AlertComputeUseCase {
	return &AlertComputeUseCase{
		snapshots:      snapshots,
		configRepo:     configRepo,
		trendlineStore: trendlineStore,
	}
}

// RefreshAlertTrendline eagerly recomputes and RAM-publishes alert levels for every
// config's alert subset over the current snapshot bars; called by Refresh after each
// publish. Configs fan out across a NumCPU-bounded errgroup — safe because
// AlertTrendlineStore.Publish is lock-free across distinct config IDs and
// computeAlertTrendline is a pure read over the immutable bars.
func (uc *AlertComputeUseCase) RefreshAlertTrendline(ctx context.Context) error {
	if uc.trendlineStore == nil {
		return nil
	}
	bars, _, ok := uc.snapshots.BarSeries()
	if !ok {
		return nil // no bars yet (boot, before the first live refresh)
	}
	configs, err := uc.configRepo.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("eager alert-level publish: load configs: %w", err)
	}

	g := new(errgroup.Group)
	g.SetLimit(runtime.NumCPU())
	for _, cfg := range configs {
		cfg := cfg
		g.Go(func() error {
			symbols := cfg.AlertSubsetSymbols()
			if len(symbols) == 0 {
				return nil
			}
			uc.trendlineStore.Publish(string(cfg.ID), uc.computeAlertTrendline(bars, cfg, symbols))
			return nil
		})
	}
	_ = g.Wait()
	return nil
}

// RecomputeForConfig recomputes ONE config's alert levels from the snapshot bars and
// republishes them for the next tick. An empty alert subset removes the key (so a stale
// level can't re-fire); a nil trendlineStore or bars-cold snapshot is a no-op. RAM-only.
// The single per-config recompute primitive, driven by UseCase.OnConfigUpdated (config
// edit) and UseCase.Recompute (POST /stocks/recompute).
func (uc *AlertComputeUseCase) RecomputeForConfig(ctx context.Context, configID string) error {
	if uc.trendlineStore == nil {
		return nil
	}

	cfg, err := uc.configRepo.GetByID(ctx, configID)
	if err != nil {
		return err
	}

	symbols := cfg.AlertSubsetSymbols()
	if len(symbols) == 0 {
		uc.trendlineStore.Remove(configID)
		return nil
	}

	bars, _, ok := uc.snapshots.BarSeries()
	if !ok {
		// No bars yet (edited before the first live refresh); the first refresh covers it.
		return nil
	}

	uc.trendlineStore.Publish(configID, uc.computeAlertTrendline(bars, cfg, symbols))
	return nil
}

// computeAlertTrendline computes AlertTrendline for the watched symbols under cfg over
// the shared immutable bars; symbols without bars are skipped. Pure read.
func (uc *AlertComputeUseCase) computeAlertTrendline(bars map[string][]marketvo.MarketData, cfg *configagg.TradingConfig, symbols []marketvo.Symbol) map[string]analysisvo.AlertTrendline {
	trendlineBySymbol := make(map[string]analysisvo.AlertTrendline, len(symbols))
	for _, sym := range symbols {
		key := string(sym)
		b, ok := bars[key]
		if !ok {
			continue
		}
		trendlineBySymbol[key] = analysissvc.ComputeAlertTrendline(b, cfg)
	}
	return trendlineBySymbol
}
