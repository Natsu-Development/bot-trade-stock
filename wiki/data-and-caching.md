---
title: "Stock metrics data flow and caching"
tags: ["stock-metrics", "cache", "concurrency"]
created: 2026-05-22
updated: 2026-06-09
sources: ["docs/data-and-caching.md"]
category: architecture
confidence: high
schemaVersion: 1
---

# Stock metrics: data flow & caching

`metrics.UseCase` (`application/usecase/metrics/`) owns the all-stock
metrics universe that powers the screener (`/stocks/filter`) and the 15s watchlist
tick. Layer 1 computes **config-independent base metrics only** — it loads no
config and computes **zero** signals. Every config-derived value (the 6 screener
signal flags AND the watchlist resistance/support/proximity levels) is per-config
(Layer 2).

## Caching model (3 caches, all in `application/service/`)

All three caches are **in-memory, named `*Store` types in `application/service/`**,
each consumed concretely by the use cases (no port interface — they are
application-internal collaborators with a single implementation; see
[adr-0002](adr-0002-two-track-alert-and-analyze-architecture.md)). The store types
are the consistent shape; the use cases hold them.

| Store (`application/service/`) | Holds | Concurrency | Written by | Read by | Invalidation |
|---|---|---|---|---|---|
| **`SnapshotStore`** (`snapshot_store.go`) | one immutable `Snapshot{Base, Ranked, Bars, CachedAt}` | `atomic.Pointer[Snapshot]`, lock-free reads | `StockMetricsUseCase` (boot `LoadFromDB` + daily `refresh`) | screener `Filter`, 15s tick `MetricsBySymbol`, Layer-2 `BarSeries` | replaced wholesale each publish (new `CachedAt`) |
| **`SignalFlagsStore`** (`signal_flags_store.go`) | per-config screener `SignalFlags` (flags only) | `hashicorp/golang-lru/v2`, sized `SIGNALS_LRU_SIZE` | `SignalComputeUseCase` (private) | `SignalComputeUseCase.Compute` | two-part stamp `(snapshot CachedAt, config UpdatedAt)`; config edit → `OnConfigUpdated`→`Remove` |
| **`AlertTrendlineStore`** (`alert_trendline_store.go`) | per-config `AlertTrendline` (resistance/support/proximity), **watched symbols only** | `atomic.Pointer` outer map + per-config value pointer, lock-free COW | `AlertComputeUseCase` (eager publish on refresh + fresh-on-edit) | 15s watchlist tick | daily refresh re-publish + config edit; key removed when the alert subset empties. RAM-only (no persistence) |

**Shared snapshot instance.** There is exactly ONE `SnapshotStore`. It is constructed
in `wire/app.go` (`NewSnapshotStore()`) and the SAME pointer is injected into all three
collaborators: the metrics `UseCase` (the sole writer, built by `NewStockMetricsUseCase`)
and the two Layer-2 computes (`SignalComputeUseCase`, `AlertComputeUseCase`), which read
it lock-free. There is no getter — sharing is by constructor injection, wired once.

**Identity-based freshness (not TTL).** `SignalFlagsStore` is keyed by config ID;
a hit requires BOTH the snapshot `CachedAt` AND the config `UpdatedAt` to match the
live values. Both are compared with `time.Time.Equal` (NOT `==`): a `time.Time`
carries a monotonic-clock reading and BSON truncates to ms, so `==` would
spuriously mismatch.

## Refresh pipeline (`refresh`, refresh.go)

1. `ListAllStocks` from the primary provider.
2. Filter to equities via `Symbol.IsEquity()` (3-4 letter tickers + E1/FUE ETFs);
   warrants/bonds/TD-codes dropped. The fetch span is sized from `ANALYSIS_WINDOW_BARS`
   via `FetchSpanForBars(Interval1D, windowBars)` — a fixed bar count, no per-config knob.
3. `fetchBatch` — concurrent fetch bounded by `concurrency` using `errgroup.SetLimit`.
4. `CalculateBaseMetrics` per stock (no signals); `RankAll` orders the slice.
5. Persist ranked metrics to Mongo (best-effort — failure logged, continues in-memory).
6. Persist the raw bars **compressed (gob + gzip)** to the `stock_bars` collection
   (`bars_codec.go` / `stockbars_repository.go`), stamped with the SAME `calculatedAt`
   as the metrics (best-effort). This is what lets a restart rehydrate bars and recompute
   Layer-2 signals with NO provider sweep.
7. `publishSnapshot` swaps in one immutable `Snapshot` (`Base` + `Ranked` + `Bars`
   + `CachedAt`) via `SnapshotStore.Publish`; `Bars` retains the fetched series so Layer 2
   can recompute per-config signals without re-fetching.
8. The metrics orchestrator (`metrics.UseCase.Refresh`) then calls
   `AlertComputeUseCase.RefreshAlertTrendline` to eager-recompute and RAM-publish
   per-config alert trendlines for the new snapshot — explicit composition (base
   refresh THEN alert recompute), not a publish hook. A failure here is logged, not
   fatal (the tick keeps last-published levels). `metrics.UseCase` is what the
   `inbound.StockMetricsManager` port binds to; `Refresh` is now driven ONLY by the
   stock-refresh job (boot run + daily cron). `POST /stocks/recompute` does NOT call
   `Refresh` — it recomputes the caller's per-config signals from cached bars (no
   fetch) via `Filter`; see "HTTP recompute endpoint" below.

`refresh` is driven by the daily cron, so every call performs a real provider
sweep — there is no warm-cache TTL gate. **singleflight** (`refreshGroup`)
collapses concurrent `Refresh` callers into ONE in-flight run; followers piggyback
on the leader's freshly-published snapshot.

`LoadFromDB` warms the `SnapshotStore` at startup (`wire/app.go`) so the screener works
before the first refresh. It loads the persisted ranked metrics AND rehydrates the raw
bars from `stock_bars` — but ONLY when those bars are present and stamped with the SAME
`calculatedAt` as the metrics (compared with `Equal`, not `==`, for monotonic/ms-truncation
safety); a mismatch, absence, or decode error leaves `Bars` nil (the prior safe behavior).
So after a restart the screener's per-config **signals** can compute immediately from
rehydrated bars — no provider sweep. The per-config **alert-trendline** store, by contrast,
is RAM-only with no boot rehydrate, so watchlist resist/support levels stay empty until the
next refresh's eager publish (or a config edit) recomputes them.

## Layer-2 per-config compute

- **`SignalComputeUseCase`** (`signals_compute.go`) — the screener's per-config
  `SignalFlags`. Reads `SnapshotStore.BarSeries()`, serves a two-part-stamp
  `SignalFlagsStore` hit when fresh, else computes under **singleflight** (identical
  configs share one run), bounded by a NumCPU **semaphore**, and `Put`s the result.
- **`AlertComputeUseCase`** (`alerts_compute.go`) — the watchlist's per-config
  `AlertTrendline`, published into `AlertTrendlineStore` for the watched subset only.

**Fresh-on-edit.** A config save fires the single `metrics.UseCase.OnConfigUpdated`
listener (registered in `wire/app.go`), which recomputes that config's alert
trendlines (`AlertComputeUseCase`) so the watchlist tick reflects the edit
immediately. The screener signal cache needs NO explicit bust — its two-part LRU
stamp keys on the config's `UpdatedAt` (bumped on every save), so the next `Compute`
already misses the stale entry and recomputes.

## HTTP recompute endpoint (`POST /stocks/recompute` — per-config recompute, no fetch)

The endpoint does NOT fetch. The handler (`StockHandler.RecomputeStocks`) is thin: it
reads the required `config_id` and calls `StockMetricsManager.Recompute(ctx, configID)`.
`UseCase.Recompute` warms BOTH per-config caches from the cached snapshot bars —
`SignalComputeUseCase.Compute` (screener flags) runs FIRST so an unknown `config_id`
(`ErrConfigNotFound`) or cold cache (`ErrCacheNotReady`) short-circuits before any alert
work, then `AlertComputeUseCase.RecomputeForConfig` (watchlist alert trendlines) — and
returns the cache stamp via `GetCacheInfo`. The handler reports `{message, total_stocks,
calculated_at}`. The heavy provider sweep is owned solely by the stock-refresh job
(boot + cron). Response by `SnapshotStore` state:

| Snapshot state | Result |
|---|---|
| no snapshot (`BarSeries()` not ok) | **503** (`ErrCacheNotReady`, warming up) |
| snapshot present (bars nil or populated) | **200** with the cache stamp + ranked size |

Unknown `config_id` → 404; missing `config_id` → 400. The screener
(`POST /stocks/filter`, also `config_id`-required) shares the same lazy
`SignalComputeUseCase.Compute` path — signals are computed per request and cached in the
two-part-stamped `SignalFlagsStore`.

## Filtering (`Filter`, screener.go)

`Filter(ctx, filter, configID)` is the use-case-side screener orchestration: it
resolves the config's per-config signals via `SignalComputeUseCase.Compute` (→
`ErrConfigNotFound` for an unknown config, `ErrCacheNotReady` before the first
snapshot), then reads `SnapshotStore.Load()`, evaluates `metricsservice.Matches` per
stock against those signals, and splices the six flags onto each returned
`ScreenerStock` — the shared snapshot entry is never mutated. A nil/empty filter
returns the full ranked set (the recompute/warm path).

## Failure modes

| Failure | Behavior |
|---------|----------|
| Mongo save fails during refresh | Logged; the in-RAM snapshot is still published |
| Cache queried before warm | `/stocks/filter` → `ErrCacheNotReady`; Layer-2 → `ErrCacheNotReady` |
| Insufficient price points (< `MinDataPoints`) | Stock marked failed; excluded from metrics |
| Eager alert-trendline publish fails | Logged; tick keeps last-published levels |

## Invariants (the load-bearing parts)

- **Snapshot immutability** — a published `Snapshot` (and its maps/slices) is
  read-only; every refresh swaps in a freshly built one. `SnapshotStore.Publish`
  never mutates in place. This is the contract that lets the high-frequency tick
  read lock-free without contending with refreshes.
- **`AlertTrendlineStore` COW ordering** — `Publish` populates a config's value
  pointer BEFORE the outer-map key becomes visible, so the tick never observes a
  key whose value pointer is unset (a one-tick silent no-fire). A bare
  `map[cfgID]*atomic.Pointer` would risk `fatal error: concurrent map read and map
  write` on key churn.

## Blast radius

`StockMetricsUseCase` is a hub: the screener handler, the 15s watchlist tick, and
startup all depend on it (via the `inbound.StockMetricsManager` port, whose surface
is unchanged by the cache reorganization). The `SnapshotStore` immutability contract
is subtle — any change to publication must keep the snapshot read-only.

## Unknowns
- **Unknown:** Mongo schema/indexes for `stock_metrics` `LoadLatest`. Verify:
  `infrastructure/mongodb/stockmetrics_repository.go`.
