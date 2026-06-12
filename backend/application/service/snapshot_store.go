package service

import (
	"sync/atomic"
	"time"

	metricsagg "backend/domain/metrics/aggregate"
	marketvo "backend/domain/shared/valueobject/market"
)

// Snapshot is the immutable, atomically-published view of the shared metrics
// pipeline: base metrics keyed by symbol, the RankAll-ordered slice for the
// screener's default display (same underlying pointers as Base), the raw bars
// Layer 2 recomputes signals from, plus the publish time. Published in one
// SnapshotStore.Publish so a single Load returns a self-consistent set (no
// Base/Bars/CachedAt mismatch). CachedAt is unique per publish and serves as the
// snapshot-identity stamp Layer 2 uses for its LRU freshness check. Immutable
// after publish — every field (and the maps/slices they hold) MUST be treated as
// read-only by callers.
type Snapshot struct {
	Base     map[string]*metricsagg.StockMetrics
	Ranked   []*metricsagg.StockMetrics
	Bars     map[string][]marketvo.MarketData
	CachedAt time.Time
}

// SnapshotStore holds the single immutable Snapshot, published with ONE atomic
// swap per refresh and read lock-free by every consumer (the 15s watchlist tick,
// the screener, the Layer-2 signal/alert computes). The writer is the stock
// metrics refresh pipeline; the Layer-2 use cases share the SAME *SnapshotStore
// as readers. The pointed-to Snapshot is immutable after publish.
type SnapshotStore struct {
	current atomic.Pointer[Snapshot]
}

// NewSnapshotStore returns an empty store (Load returns nil until the first Publish).
func NewSnapshotStore() *SnapshotStore {
	return &SnapshotStore{}
}

// Publish atomically swaps in snap as the current snapshot. Publishes are
// serialized (boot load, then singleflight refresh), so each stamps a distinct
// CachedAt — the invariant Layer 2 relies on when it uses CachedAt as the
// snapshot-identity key for its LRU freshness check.
func (s *SnapshotStore) Publish(snap *Snapshot) {
	s.current.Store(snap)
}

// Load returns the current snapshot, or nil before the first Publish. The result
// is a self-consistent set from one atomic load; callers MUST treat it read-only.
func (s *SnapshotStore) Load() *Snapshot {
	return s.current.Load()
}

// MetricsBySymbol returns the lock-free symbol→metrics lookup from the current
// snapshot, or nil before the cache is loaded. Shared across all readers and MUST
// NOT be mutated — each refresh swaps in a fresh snapshot.
func (s *SnapshotStore) MetricsBySymbol() map[string]*metricsagg.StockMetrics {
	if snap := s.current.Load(); snap != nil {
		return snap.Base
	}
	return nil
}

// BarSeries exposes the current snapshot's bars and CachedAt stamp to the Layer-2
// compute use cases. Returns ok=false before the first snapshot is published. bars
// and cachedAt come from ONE atomic Load, so they are always from the same
// publish; the bars map is immutable-after-publish and must not be mutated.
func (s *SnapshotStore) BarSeries() (bars map[string][]marketvo.MarketData, cachedAt time.Time, ok bool) {
	snap := s.current.Load()
	if snap == nil {
		return nil, time.Time{}, false
	}
	return snap.Bars, snap.CachedAt, true
}
