package service

import (
	"sync/atomic"

	analysisvo "backend/domain/analysis/valueobject"
)

// AlertTrendlineStore is the lock-free, per-config alert-trendline store the 15s
// watchlist tick reads. The OUTER map is wrapped in an atomic.Pointer and
// COW-swapped on key add/remove; each config's value is its own atomic.Pointer
// swapped O(1) on fresh-on-edit. The tick reads truly lock-free: one outer Load
// then one per-config Load.
//
// A BARE map[cfgID]*atomic.Pointer would be UNSAFE — only the values are atomic;
// a concurrent outer-map key insert during the tick's iteration is
// `fatal error: concurrent map read and map write` (an unrecoverable crash).
// Key churn is rare (enable/disable only) and the outer map is tiny, so the COW
// clone is cheap.
//
// The value type is analysisvo.AlertTrendline (3 floats) keyed by WATCHED symbols only —
// lean, never the full Signals nor all ~1600 symbols.
type AlertTrendlineStore struct {
	outer atomic.Pointer[map[string]*atomic.Pointer[map[string]analysisvo.AlertTrendline]]
}

// NewAlertTrendlineStore returns an empty store with a non-nil outer map.
func NewAlertTrendlineStore() *AlertTrendlineStore {
	s := &AlertTrendlineStore{}
	empty := map[string]*atomic.Pointer[map[string]analysisvo.AlertTrendline]{}
	s.outer.Store(&empty)
	return s
}

// TrendlineFor returns THIS config's tick-time resistance/support levels for a
// symbol, read lock-free: one outer Load then one per-config Load. A symbol
// absent from the config's published map — an unpublished config, or a nil store
// (not wired) — yields zero Levels (no resist/support fire), so a stale value can
// never leak through. The shared base metrics carry no levels anymore
// (StockMetrics is base-only). The nil-receiver guard lets the watchlist tick
// call this directly off a possibly-nil store field.
func (s *AlertTrendlineStore) TrendlineFor(configID, symbol string) analysisvo.AlertTrendline {
	if s == nil {
		return analysisvo.AlertTrendline{}
	}
	outer := s.outer.Load()
	if outer == nil {
		return analysisvo.AlertTrendline{}
	}
	vp, ok := (*outer)[configID]
	if !ok || vp == nil {
		return analysisvo.AlertTrendline{}
	}
	m := vp.Load()
	if m == nil {
		return analysisvo.AlertTrendline{}
	}
	return (*m)[symbol] // zero Levels when the symbol is absent
}

// Publish sets the config's trendlines.
//
// ORDERING INVARIANT (criterion 19): the value pointer is fully populated BEFORE
// the key becomes visible in the outer map, so the tick never observes a key
// whose value pointer is unset (a one-tick silent no-fire). An existing key
// swaps its value pointer O(1) (no outer COW); a new key COW-clones the outer
// map with the already-populated value pointer.
func (s *AlertTrendlineStore) Publish(configID string, trendlines map[string]analysisvo.AlertTrendline) {
	if outer := s.outer.Load(); outer != nil {
		if vp, ok := (*outer)[configID]; ok && vp != nil {
			vp.Store(&trendlines) // existing key: O(1) value swap, no outer churn
			return
		}
	}

	// New key: populate the value pointer FIRST, then COW the outer map.
	vp := &atomic.Pointer[map[string]analysisvo.AlertTrendline]{}
	vp.Store(&trendlines)
	for {
		cur := s.outer.Load()
		if existing, ok := (*cur)[configID]; ok && existing != nil {
			// Lost a race to another Publish that inserted the key — fall back to
			// the O(1) value swap on the winner's pointer.
			existing.Store(&trendlines)
			return
		}
		clone := make(map[string]*atomic.Pointer[map[string]analysisvo.AlertTrendline], len(*cur)+1)
		for k, v := range *cur {
			clone[k] = v
		}
		clone[configID] = vp
		if s.outer.CompareAndSwap(cur, &clone) {
			return
		}
	}
}

// Remove deletes the config's key via an outer COW clone (the config disabled
// its last price alert). No-op when the key is absent.
func (s *AlertTrendlineStore) Remove(configID string) {
	for {
		cur := s.outer.Load()
		if _, ok := (*cur)[configID]; !ok {
			return
		}
		clone := make(map[string]*atomic.Pointer[map[string]analysisvo.AlertTrendline], len(*cur))
		for k, v := range *cur {
			if k == configID {
				continue
			}
			clone[k] = v
		}
		if s.outer.CompareAndSwap(cur, &clone) {
			return
		}
	}
}
