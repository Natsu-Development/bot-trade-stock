package metrics

import (
	"context"
	"fmt"
	"runtime"
	"sync"

	"backend/application/port/inbound"
	"backend/application/port/outbound"
	appservice "backend/application/service"
	analysissvc "backend/domain/analysis/service"
	analysisvo "backend/domain/analysis/valueobject"
	configagg "backend/domain/config/aggregate"
	marketvo "backend/domain/shared/valueobject/market"

	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
	"golang.org/x/sync/singleflight"
)

// SignalComputeUseCase computes per-config screener SignalFlags over the shared
// snapshot's bars. It is provider-free (pure CPU over already-fetched bars).
// Concurrency is bounded by a process-wide semaphore (caps the distinct-config
// stampede) and per-call by an errgroup limit (intra-call symbol fan-out);
// identical-config callers collapse via singleflight; results are cached in a
// two-part-stamped LRU.
type SignalComputeUseCase struct {
	snapshots  *appservice.SnapshotStore
	configRepo outbound.ConfigRepository

	cache        *appservice.SignalFlagsStore
	computeGroup singleflight.Group
	sem          *semaphore.Weighted
}

// NewSignalComputeUseCase builds the screener-flags use case. snapshots is the
// shared SnapshotStore (the bars source, written by the metrics UseCase); lruSize
// caps the per-config screener cache. The compute semaphore is sized to NumCPU.
func NewSignalComputeUseCase(
	snapshots *appservice.SnapshotStore,
	configRepo outbound.ConfigRepository,
	lruSize int,
) (*SignalComputeUseCase, error) {
	cache, err := appservice.NewSignalFlagsStore(lruSize)
	if err != nil {
		return nil, fmt.Errorf("init signal-flags store: %w", err)
	}
	return &SignalComputeUseCase{
		snapshots:  snapshots,
		configRepo: configRepo,
		cache:      cache,
		sem:        semaphore.NewWeighted(int64(runtime.NumCPU())),
	}, nil
}

// Compute returns the per-config signals for every symbol in the current
// snapshot. It guards identity (an unknown config_id returns ErrConfigNotFound,
// never computing nor caching), serves a two-part-stamp LRU hit when fresh, and
// otherwise computes under singleflight (so identical-config callers share one
// run) and caches the result.
func (uc *SignalComputeUseCase) Compute(ctx context.Context, configID string) (map[string]analysisvo.SignalFlags, error) {
	cfg, err := uc.configRepo.GetByID(ctx, configID)
	if err != nil {
		return nil, err
	}

	bars, cachedAt, ok := uc.snapshots.BarSeries()
	if !ok {
		return nil, inbound.ErrCacheNotReady
	}

	if sigs, hit := uc.cache.Get(configID, cachedAt, cfg.UpdatedAt); hit {
		return sigs, nil
	}

	v, err, _ := uc.computeGroup.Do("signals:"+configID, func() (any, error) {
		// Double-check inside the singleflight: a concurrent leader may have just
		// filled the cache for this (cachedAt, UpdatedAt).
		if sigs, hit := uc.cache.Get(configID, cachedAt, cfg.UpdatedAt); hit {
			return sigs, nil
		}
		sigs, cerr := uc.computeAll(ctx, bars, cfg)
		if cerr != nil {
			return nil, cerr
		}
		uc.cache.Put(configID, cachedAt, cfg.UpdatedAt, sigs)
		return sigs, nil
	})
	if err != nil {
		return nil, err
	}
	return v.(map[string]analysisvo.SignalFlags), nil
}

// computeAll runs ComputeSignalFlags for every symbol's bars under cfg. It
// acquires ONE semaphore permit per batch (capping concurrent distinct-config
// computes at NumCPU batches) and bounds the intra-batch symbol fan-out with an
// errgroup limit.
func (uc *SignalComputeUseCase) computeAll(ctx context.Context, bars map[string][]marketvo.MarketData, cfg *configagg.TradingConfig) (map[string]analysisvo.SignalFlags, error) {
	if err := uc.sem.Acquire(ctx, 1); err != nil {
		return nil, err
	}
	defer uc.sem.Release(1)

	out := make(map[string]analysisvo.SignalFlags, len(bars))
	var mu sync.Mutex
	var g errgroup.Group
	g.SetLimit(runtime.NumCPU())
	for sym, b := range bars {
		sym, b := sym, b
		g.Go(func() error {
			sig := analysissvc.ComputeSignalFlags(b, cfg)
			mu.Lock()
			out[sym] = sig
			mu.Unlock()
			return nil
		})
	}
	_ = g.Wait()
	return out, nil
}
