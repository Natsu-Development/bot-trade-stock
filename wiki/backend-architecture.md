---
title: "Backend architecture"
tags: ["go", "clean-architecture", "ddd", "backend"]
created: 2026-05-22
updated: 2026-05-22
sources: ["docs/backend-architecture.md"]
category: architecture
confidence: high
schemaVersion: 1
---

# Backend architecture — bot-trade

## Layering and dependency rule

Dependency flows inward only: `infrastructure → application → domain`. Domain and application
packages import no external libraries beyond the standard library and `zap`/`errgroup`
(application). The rule is enforced by convention and compile-time interface assertions
(`var _ Interface = (*Impl)(nil)`).

Boot sequence (`cmd/server/main.go:18-47`):
1. `config.LoadInfraFromEnv()` — fail-fast; aggregates all missing-env errors and returns them together (`config/config.go:67-119`).
2. `wire.New(cfg)` — three-layer DI.
3. `app.StartSchedulers()` — registers cron jobs.
4. HTTP server starts in a goroutine; main blocks in `waitForShutdown`.

## Dependency injection (manual Wire)

`wire.New` builds in strict order with cleanup-on-failure:
- `NewInfra` (`wire/infra.go:32`): logger → Mongo connection (10s timeout) → retrying HTTP client (60s) → provider pool → SSI credential store. Any failure returns early; partial resources are released by the caller.
- `NewAppServices` (`wire/app.go:42`): repositories, gateway, notifier, the SSI quote provider, use cases, the job scheduler, and all jobs via the factory registry (`wire/app.go:116-124`).
- `NewPresentation`: handlers + router.

The provider pool is built from a global registry of provider factories
(`wire/infra.go:86-96`), each wrapped with a per-provider token bucket and metrics.

> Naming note: the package is called `wire` but does **not** use Google Wire codegen — DI is hand-written and explicit.

## Domain services (pure)

- **Divergence detection** (`domain/analysis/service/divergence_detector.go`): bullish =
  price lower-low while RSI higher-low; bearish = price higher-high while RSI lower-high.
  Pivots are sorted descending and adjacent pairs checked within `[rangeMin,rangeMax]` bars
  (`:34-52`). Pure functions returning value objects — trivially testable.
- **Pivot finder, trendline builder, signal generator** (`domain/analysis/service/`): build
  support/resistance lines and emit potential/confirmed breakout/breakdown signals.
- **AlertEvaluator** (`domain/config/service/alert_evaluator.go`): the only `switch` over
  `AlertType` in the codebase (`:43`). Owns both fire/no-fire and value formatting. `volume_spike`
  returns no-fire when metrics are nil (`:58-60`), so a cold cache degrades gracefully.

## Application use cases

- **AnalyzeUseCase** (`application/usecase/analyze/orchestrator.go`): the HTTP analysis path.
  Prepares data **once** via `Preparer`, then runs bullish/bearish RSI and breakout/breakdown
  use cases over the same prepared data (no per-use-case I/O), and combines into one DTO
  (`:74-114`). This is the key DRY/perf decision — one fetch, four analyses.
- **StockMetricsUseCase** (`application/usecase/stock_metrics.go`): see [`data-and-caching.md`](./data-and-caching.md).

## Failure modes & recovery (backend)

| Failure | Symptom | First action |
|---------|---------|--------------|
| Mongo unreachable at boot | Process exits, `failed to connect to MongoDB` | Check mongo health; bot has `depends_on: mongo healthy` |
| No providers registered | `No providers registered`, pool is nil, gateway nil-guarded (`wire/app.go:51`) | Verify provider registry imports; refresh/analyze will fail "gateway does not support…" |
| Primary provider name mismatch | `NewProviderPool` returns error → boot fails | Fix `PRIMARY_PROVIDER` env to match a registered provider |
| Invalid cron timezone | Warn, falls back to UTC (`wire/app.go:92-96`) | Fix `CRON_TIMEZONE` |
| 5-field cron schedule | Job registration error at startup | Prepend `0 ` to make it 6-field (`job_scheduler.go:35`) |

## Safe-change guidance

`MarketGateway`, `ProviderPool.FetchData`, `Preparer.Prepare`, `StockMetricsUseCase`,
is mandatory and HIGH/CRITICAL results must be reported before proceeding.

## Unknowns
- **Unknown:** whether handlers map domain errors to HTTP status codes consistently. Verify: read `presentation/http/handler/*.go` and `response/response.go`.
