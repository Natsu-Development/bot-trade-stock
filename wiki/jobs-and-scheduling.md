---
title: "Jobs and scheduling"
tags: ["cron", "jobs", "alerts", "scheduler"]
created: 2026-05-22
updated: 2026-06-09
sources: ["docs/jobs-and-scheduling.md"]
category: architecture
confidence: high
schemaVersion: 1
---

# Jobs & scheduling

Background work runs on a cron scheduler abstracted behind the `CronAdapter` port. Jobs
implement the minimal `Job` interface (`Metadata()` + `Execute(ctx)`) and self-register.

> **Amended 2026-06-06 — per-config alert levels (no-system).** The 15s watchlist tick now reads
> resist/support levels **per config**, not from the shared metrics map. In `watchlist_job.processConfig`
> each watched symbol is evaluated from TWO lock-free inputs: the shared base metrics (for
> `volume_spike`'s `VolumeSMA20` and price-cross MAs — both config-independent) via `MetricsBySymbol`,
> and this config's tick-time resistance/support from the per-config `AlertTrendlineStore`
> (`trendlineStore.TrendlineFor(cfg.ID, symbol)`), passed to the evaluator as a **separate argument** —
> the shared snapshot entry is never mutated. The trendline store is **RAM-only (no persistence)**:
> published by the refresh / Layer-2 path (eager publish after each refresh) and fresh-on-edit; after a
> restart it stays empty until the next refresh's eager publish recomputes it. See ADR-0002's amendment.

## Registration (factory + blank-import pattern)

`application/jobs/register.go` blank-imports `analyze`, `refresh`, `watchlist`. Each package's
`init()` calls `registry.RegisterFactory(name, factory)` (e.g. `RegisterFactory("watchlist", …)`).
At wiring time, `wire/app.go` iterates the global registry, builds jobs from `JobDependencies`,
and registers them. A factory may return `nil` jobs when its interval is disabled (e.g. `watchlist`
when its `default` interval is disabled — `jobs/watchlist/watchlist_job.go`).

## Scheduler contract (`application/service/job_scheduler.go`)

- Requires **6-field** cron (`sec min hour dom month dow`); 5-field schedules are rejected with a
  helpful message (`:35-40`).
- Each tick runs `Execute` under a per-job `context.WithTimeout(meta.Timeout)` (`:42-52`). A job
  error is logged, not propagated — one bad tick won't kill the scheduler.

## Analysis jobs (`application/jobs/analyze/base.go`)

`AnalysisJob` is generic, parameterized by a `SymbolSelector` (bullish vs bearish watchlist) and
an `AnalyzeFunc`. `Execute` loads all configs, then per config fans out over selected symbols with
`errgroup` bounded by `Concurrency` (`:61-73`). Per symbol: build query → `Preparer.Prepare` →
analyze → if a signal message is produced, `notifier.Send` to that config's Telegram (`:75-101`).
Bullish/bearish/breakout/breakdown each register 1H/1D/1W variants driven by env
(`config/config.go:122-140`).

## Stock-refresh job

Wraps `metrics.UseCase.Refresh` (see [`data-and-caching.md`](./data-and-caching.md)) — the
orchestrator runs the Layer-1 base refresh (provider sweep → base metrics → rank → Mongo →
publish snapshot) and then eagerly recomputes per-config alert trendlines. It is the SOLE owner
of the provider fetch.

**Boot run + daily cron.** The job runs ONCE at startup AND on the daily cron, both gated by
`STOCK_REFRESH_ENABLED` (when disabled, the factory returns no job → no boot run, no cron). The
boot run is wired in `StartSchedulers` via `JobScheduler.RunOnStart(stockRefreshJob)` — launched
after `Scheduler.Start()` and after `wire.New` has returned (so it cannot race `LoadFromDB`'s boot
publish; publishes are serialized). It is fire-and-forget: timeout-bounded by the job's
`Metadata().Timeout`, panic-recovered, and non-blocking, so a slow/failed provider can never stall
or crash startup. `wire/app.go` captures the handle by `Metadata().Name == "stock-refresh"` from
the factory loop; a disabled job yields a nil handle and `RunOnStart` no-ops.

> **Note:** `POST /stocks/recompute` is NOT a fetch — it recomputes the caller's per-config signals
> from the already-cached bars and never sweeps the provider. The heavy fetch is this job's job.
> See [`data-and-caching.md`](./data-and-caching.md) and the refresh-metrics runbook.

## Watchlist job (`application/jobs/watchlist/watchlist_job.go`)

Highest-frequency job (~15s default, factory name `watchlist`). It is HoSE-session-gated
(`IsHoSEActiveQuoteWindow`, overridable via `WATCHLIST_IGNORE_SESSION_GATE` for dev/demo). Per tick:
1. `FetchAllQuotes` from the SSI quote provider.
2. **Two lock-free reads:** the shared `symbol→metrics` map (`SnapshotStore.MetricsBySymbol`, base
   metrics — may be nil before cache warms) and, per symbol, this config's resist/support from
   `AlertTrendlineStore.TrendlineFor(cfg.ID, symbol)`.
3. O(1) reference-swap of `prevQuotes` under a small mutex (consistent prev across all conditions in a tick).
4. Load all configs; for each enabled non-`IsAnalyzeOnly()` condition delegate to
   `WatchlistEvaluator.Evaluate(cond, quote, prev, base, trendline)`; on fire, send Telegram and
   **auto-disable that condition** via `ConditionDisabler.Disable` — a Mongo `arrayFilter`-scoped
   `$set` that touches only the fired condition, never the whole document.

The scoped per-condition write (not a whole-doc update) is what lets this high-frequency writer
coexist with the analyze jobs' concurrent disables without clobbering siblings. See
[ADR-0002](./adr-0002-two-track-alert-and-analyze-architecture.md).

## Failure modes

| Failure | Behavior |
|---------|----------|
| Quote fetch fails | Tick aborts with wrapped error; logged by scheduler; retried next tick |
| Base metrics cold | `MetricsBySymbol()` nil → `volume_spike` / price-cross conditions skip gracefully |
| Trendline store empty (boot, pre-first-refresh) | `TrendlineFor` returns zero levels → resist/support conditions don't fire until the first eager publish |
| Telegram send fails | Logged per symbol; tick continues (`base.go:98`, `watchlist_job.go`) |
| Config persist fails after fire | Logged; alert may re-fire next tick (no auto-disable persisted) |

## Unknowns
- **Unknown:** the SSI quote provider's `FetchAllQuotes` cost/scope (all symbols vs watchlist). Verify: `infrastructure/provider/sources/ssi_quote.go`.
