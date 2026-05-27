---
title: "Jobs and scheduling"
tags: ["cron", "jobs", "alerts", "scheduler"]
created: 2026-05-22
updated: 2026-05-22
sources: ["docs/jobs-and-scheduling.md"]
category: architecture
confidence: high
schemaVersion: 1
---

# Jobs & scheduling

Background work runs on a cron scheduler abstracted behind the `CronAdapter` port. Jobs
implement the minimal `Job` interface (`Metadata()` + `Execute(ctx)`) and self-register.

## Registration (factory + blank-import pattern)

`application/jobs/register.go` blank-imports `alert`, `analyze`, `refresh`. Each package's
`init()` calls `registry.RegisterFactory(name, factory)`. At wiring time, `wire/app.go:116-124`
iterates the global registry, builds jobs from `JobDependencies`, and registers them. A factory
may return `nil` jobs when its interval is disabled (e.g. `stock_alert` when not enabled —
`jobs/alert/stock_alert_job.go:47-49`).

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

Wraps `StockMetricsUseCase.Refresh` (see [`data-and-caching.md`](./data-and-caching.md)). Recomputes the all-stock metrics
universe and repopulates the RAM cache + Mongo.

## Stock-alert job (`application/jobs/alert/stock_alert_job.go`)

Highest-frequency job (~15s default). Per tick (`:82-111`):
1. `FetchAllQuotes` from the SSI quote provider.
2. Lock-free read of the `symbol→metrics` map (`MetricsBySymbol`) — may be nil before cache warms.
3. O(1) reference-swap of `prevQuotes` under a small mutex (consistent prev across all conditions in a tick).
4. Load all configs; per enabled condition, delegate to `AlertEvaluator.Evaluate`; on fire, send Telegram and **auto-disable that condition** (`cond.Enabled=false`), then persist (`:113-170`).

This is the only writer that mutates config from a job. See the auto-disable concurrency unknown in [`project-overview.md`](./project-overview.md).

## Failure modes

| Failure | Behavior |
|---------|----------|
| Quote fetch fails | Tick aborts with wrapped error; logged by scheduler; retried next tick |
| Cache cold | `MetricsBySymbol()` nil → volume_spike conditions skip gracefully |
| Telegram send fails | Logged per symbol; tick continues (`base.go:98`, `alert:153-159`) |
| Config persist fails after fire | Logged; alert may re-fire next tick (no auto-disable persisted) |

## Unknowns
- **Unknown:** the SSI quote provider's `FetchAllQuotes` cost/scope (all symbols vs watchlist). Verify: `infrastructure/provider/sources/ssi_quote.go`.
