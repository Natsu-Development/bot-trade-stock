package service

import (
	"fmt"
	"time"

	analysisvo "backend/domain/analysis/valueobject"

	lru "github.com/hashicorp/golang-lru/v2"
)

// cachedSignalFlags is one LRU entry: the per-config signal map plus the two-part
// validity stamp (snapshot CachedAt + config UpdatedAt). It is reused only when
// BOTH match the live snapshot/config; otherwise the entry is recomputed.
type cachedSignalFlags struct {
	snapshotCachedAt time.Time
	configUpdatedAt  time.Time
	signals          map[string]analysisvo.SignalFlags
}

// fresh reports whether this entry still matches the live snapshot (by CachedAt)
// and config UpdatedAt. Both are compared via Equal (NOT ==): a time.Time carries
// a monotonic-clock reading and BSON truncates to ms, so == would spuriously
// mismatch.
func (e *cachedSignalFlags) fresh(cachedAt, updatedAt time.Time) bool {
	return e.snapshotCachedAt.Equal(cachedAt) && e.configUpdatedAt.Equal(updatedAt)
}

// SignalFlagsStore is the per-config screener-signal cache: a two-part-stamped LRU
// keyed by config ID. A hit requires BOTH the snapshot CachedAt and the config
// UpdatedAt to match the live values (identity-based freshness, no TTL). It owns
// storage + freshness only; compute orchestration (singleflight, semaphore) lives
// in SignalComputeUseCase.
type SignalFlagsStore struct {
	lru *lru.Cache[string, *cachedSignalFlags]
}

// NewSignalFlagsStore builds the screener-flags LRU sized to size entries.
func NewSignalFlagsStore(size int) (*SignalFlagsStore, error) {
	cache, err := lru.New[string, *cachedSignalFlags](size)
	if err != nil {
		return nil, fmt.Errorf("create signals LRU: %w", err)
	}
	return &SignalFlagsStore{lru: cache}, nil
}

// Get returns the cached signals for configID when the entry is present AND fresh
// for the given (snapshot CachedAt, config UpdatedAt) stamp; hit=false otherwise.
func (s *SignalFlagsStore) Get(configID string, cachedAt, updatedAt time.Time) (map[string]analysisvo.SignalFlags, bool) {
	entry, ok := s.lru.Get(configID)
	if !ok || !entry.fresh(cachedAt, updatedAt) {
		return nil, false
	}
	return entry.signals, true
}

// Put stores signals for configID stamped with the given snapshot CachedAt and
// config UpdatedAt.
func (s *SignalFlagsStore) Put(configID string, cachedAt, updatedAt time.Time, signals map[string]analysisvo.SignalFlags) {
	s.lru.Add(configID, &cachedSignalFlags{
		snapshotCachedAt: cachedAt,
		configUpdatedAt:  updatedAt,
		signals:          signals,
	})
}
