---
title: "Stock metrics data flow and caching"
tags: ["stock-metrics", "cache", "concurrency"]
created: 2026-05-22
updated: 2026-05-22
sources: ["docs/data-and-caching.md"]
category: architecture
confidence: high
schemaVersion: 1
---

# Stock metrics: data flow & caching

`StockMetricsUseCase` (`application/usecase/stock_metrics.go`) owns the all-stock metrics universe
that powers the screener (`/stocks/filter`) and the alert job's `volume_spike` evaluation.

## Refresh pipeline (`refresh`, `:115-244`)

1. Load `system` config for signal params (missing → signals skipped, warn).
2. `ListAllStocks` from the primary provider.
3. Filter to equities via `equitySymbolRe` (3-4 letter tickers + E1/FUE ETFs); warrants/bonds/TD-codes dropped (`:35`, `:142-167`).
4. `fetchBatch` — concurrent fetch bounded by `concurrency` using `errgroup.SetLimit` (`:366-396`).
5. Calculate metrics per stock; compute RSI/divergence/trendline signals with date-threshold checks (`computeSignals`, `:399-484`).
6. Rank all stocks by relative position; persist to Mongo (best-effort — failure logged, continues in-memory); cache in RAM.

## Concurrency design (the load-bearing part)

- **singleflight** dedupes concurrent `Refresh` calls — late callers piggyback on the in-flight run (`:101-110`).
- Two cache representations are published together under `cacheMu`:
  - `cachedMetrics []*StockMetrics` (slice, for the screener) guarded by `sync.RWMutex`;
  - `metricsBySymbol atomic.Pointer[map[...]]` published via atomic store for **lock-free** reads by the 15s alert job (`:64`, `:225-230`).
- The published map is **immutable** post-store; each refresh swaps in a freshly-built map (`buildMetricsMap`, `:72-78`). Callers must treat it read-only (`:285-294`). This is the explicit contract that lets the high-frequency alert job avoid lock contention with refreshes.

`LoadFromDB` warms the cache at startup (`wire/app.go:73-77`, `:310-334`) so signals/screener
work before the first refresh.

## Filtering (`Filter`, `:251-283`)

Reads under `RLock`, returns `ErrCacheNotReady` if the cache is empty, delegates per-stock match
to the domain `metricsservice.Matches` (AND/OR filter logic). Validation happens at the handler
during JSON unmarshal.

## Failure modes

| Failure | Behavior |
|---------|----------|
| Mongo save fails during refresh | Logged; in-RAM cache still updated (`:215-222`) |
| Cache queried before warm | `/stocks/filter` → `ErrCacheNotReady`; alert volume_spike skipped |
| Insufficient price points (<21) | Stock marked failed; excluded from metrics (`:206`) |

## Blast radius

`StockMetricsUseCase` is a hub: the screener handler, the alert job, and startup all depend on it.
The lock-free map contract is subtle — any change to publication must keep map immutability.

## Unknowns
- **Unknown:** Mongo schema/indexes for `stock_metrics` `LoadLatest`. Verify: `infrastructure/mongodb/stockmetrics_repository.go`.
