---
title: "Project overview: bot-trade-stock"
tags: ["architecture", "runtime", "api", "operations"]
created: 2026-05-22
updated: 2026-05-22
sources: ["docs/CODEBASE_MAP.md"]
category: architecture
confidence: high
schemaVersion: 1
---

# Project overview — bot-trade-stock

A trading bot for the Vietnamese stock market. It detects RSI divergences and trendline
breakouts/breakdowns, screens stocks by relative-strength metrics, fires real-time
price/volume alerts, and pushes signals to Telegram. A React terminal UI consumes the
Go HTTP API.

## Documentation intent

- **Audience:** new engineers onboarding, on-call responders, refactor owners.
- **Primary tasks:** (1) understand how a signal travels from market data to a Telegram alert; (2) know what fails and how to recover (provider outages, stale SSI cookies, cold cache); (3) change code safely within the Clean/Hexagonal boundaries.
- **Decision horizon:** onboarding, incident response, refactor review.
- **Out of scope:** trading-strategy correctness (RSI/divergence math validity), Grafana dashboard internals, secret values.

## System at a glance

- **Backend** (`backend/`): Go 1.23, Gin HTTP, MongoDB, robfig/cron, zap logging,
  Prometheus metrics. Strict Clean Architecture + DDD + Hexagonal ports/adapters.
- **Frontend** (`frontend/`): React 18 + TypeScript + Vite, lightweight-charts, Tailwind.
  Single `ApiClient` singleton (`frontend/src/lib/api.ts:315`).
- **Runtime** (`docker/docker-compose.prod.yml`): nginx (TLS) → bot-trade → mongo, plus
  flaresolverr (Cloudflare cookie solver), grafana-alloy + cAdvisor (telemetry).

## Architecture layers (dependency direction: infra → application → domain)

| Layer | Path | Depends on external? | Role |
|-------|------|----------------------|------|
| Domain | `backend/domain/` | No | Pure business logic: divergence, trendlines, metrics, config, alerts |
| Application | `backend/application/` | No (interfaces only) | Use cases, jobs, ports, DTOs |
| Infrastructure | `backend/infrastructure/` | Yes | Mongo, HTTP providers, Telegram, cron, credentials |
| Presentation | `backend/presentation/http/` | Yes | Gin handlers, router, middleware |
| Wiring | `backend/wire/` | Yes | Manual DI (3 layers) |
| Entrypoint | `backend/cmd/server/main.go` | Yes | Boot, schedulers, graceful shutdown |

Interface compliance is asserted at compile time, e.g. `var _ outbound.MarketGateway = (*ProviderPool)(nil)` (`backend/infrastructure/provider/pool.go:26`).

## Bounded contexts (domain/)

| Context | Path | Core concepts |
|---------|------|---------------|
| analysis | `domain/analysis/` | `Divergence`, `Trendline`, `Signal`, pivot finder, signal generator |
| metrics | `domain/metrics/` | `StockMetrics` aggregate, RS ranking calculator, filterer |
| config | `domain/config/` | `TradingConfig` aggregate, `AlertEvaluator`, watchlists, alert conditions |
| shared | `domain/shared/` | `MarketData`, `MarketQuote`, `Symbol`, `Interval`, filter value objects, RSI indicator |

## Top modules by size

| Module | Symbols | Cohesion | Notes |
|--------|---------|----------|-------|
| Ui | 76 | 74% | Frontend components |
| Service | 59 | 77% | App + domain services |
| Handler | 26 | 95% | HTTP handlers — very cohesive |
| Analyze | 25 | 82% | Analysis use cases |
| Screener | 23 | 76% | Stock screener (FE) |
| Chart | 23 | 90% | Charting (FE) |
| Provider | 21 | 84% | Market data adapters |
| Alert | 7 | 100% | Stock-alert job — fully self-contained |

## HTTP API surface (`backend/presentation/http/router.go`)

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/health` | inline | Liveness (used by docker healthcheck) |
| GET | `/metrics` | promhttp | Prometheus runtime + provider metrics |
| POST | `/config` | `ConfigHandler.CreateConfig` | Create trading config |
| GET/PUT/DELETE | `/config/:id` | `ConfigHandler` | Config CRUD |
| POST/DELETE | `/config/:id/watchlist` | `ConfigHandler` | Watchlist add/remove |
| GET | `/analyze/:symbol` | `AnalyzeHandler.Analyze` | Full analysis (divergence + trendlines + signals + price history) |
| POST | `/stocks/refresh` | `StockHandler.RefreshStocks` | Recompute + cache all-stock metrics |
| POST | `/stocks/filter` | `StockHandler.FilterStocks` | Filter cached metrics (AND/OR) |
| GET | `/stocks/cache-info` | `StockHandler.GetCacheInfo` | Cache freshness |

Frontend consumes these via `ApiClient` (`frontend/src/lib/api.ts`), base URL `VITE_API_URL` (default `http://localhost:8080`).

## Scheduled jobs (cron)

Jobs self-register via `init()` + factory pattern (`application/jobs/register.go` blank-imports
each package; factories registered in `registry.GlobalRegistry()`). The scheduler **requires
6-field cron** (sec min hour dom month dow) and errors otherwise (`application/service/job_scheduler.go:35`).

| Job | Factory | Intervals | Source |
|-----|---------|-----------|--------|
| bullish-rsi / bearish-rsi | `bullish` / `bearish` | 1H, 1D, 1W (per-config env) | `jobs/analyze/*_rsi_job.go` |
| breakout / breakdown | `breakout` / `breakdown` | 1H, 1D, 1W | `jobs/analyze/break*_job.go` |
| stock-refresh | `stock_refresh` | single (`default`) | `jobs/refresh/stock_refresh_job.go` |
| stock-alert | `stock_alert` | single (`default`, ~15s) | `jobs/alert/stock_alert_job.go` |

Each interval is independently enabled/scheduled via env (`config/config.go:122-167`),
e.g. `BULLISH_1H_ENABLED`, `BULLISH_1H_SCHEDULE`. A disabled or empty-schedule interval
is skipped at factory time.

## Infrastructure & runtime context

Production topology (`docker/docker-compose.prod.yml`):

- **nginx** (frontend image, TLS via Cloudflare Origin CA at `/etc/ssl/cloudflare`) is the only public surface (80/443). Limits: 0.1 CPU / 64M.
- **bot-trade** (Go) internal-only on `:8080`. Limits: 0.5 CPU / 128M. `GOMEMLIMIT` set via env.
  Reads two env files (`.env.secrets`, `.env.production`) and bind-mounts `/etc/bot-trade`
  **as a directory, not a file** — required so cookie-refresh inode replacement is visible to SIGHUP reload (`docker-compose.prod.yml:43-48`).
- **mongo:7** persistent store (`mongo-data` volume).
- **flaresolverr** solves Cloudflare challenges to mint SSI cookies; localhost-bound `:8191`.
- **alloy + cadvisor** ship metrics/logs to Grafana Cloud.

CI/CD: `.github/workflows/deploy.yml` builds bot + frontend images on push to `master`,
tags with `github.sha`, parses `config/production.env` for non-secret config.

## SSI credential hot-reload (operational)

The SSI quote provider needs Cloudflare cookies that expire. Operators refresh them and send
`SIGHUP` to the bot; the process re-parses the env file and atomically swaps the snapshot —
**no restart, no dropped requests** (`cmd/server/main.go:57-87`, `infrastructure/credentials/env_store.go:64-72`).
SIGHUP is scoped exclusively to reload; SIGINT/SIGTERM trigger graceful shutdown.

## Key flows

```
Cron tick (e.g. bullish-rsi-1D)
 → AnalysisJob.Execute               application/jobs/analyze/base.go:49
 → ConfigRepository.GetAll            (Mongo)
 → per config, errgroup over watchlist symbols
   → Preparer.Prepare                 fetch OHLCV via MarketGateway/ProviderPool
     → ProviderPool.FetchData         round-robin + failover  pool.go:50
       → WrappedProvider.FetchObserved token bucket + health  wrapper.go:43
   → BullishRSIUseCase.Execute        pure analysis
     → FindBullishDivergences         divergence_detector.go:20
   → if signal: Notifier.Send         Telegram   infrastructure/telegram/notifier.go
```

Real-time alert flow (every ~15s): `StockAlertJob.Execute` → `FetchAllQuotes` (SSI quote provider) + lock-free `MetricsBySymbol()` → per config/condition `AlertEvaluator.Evaluate` → on fire, Telegram + auto-disable + `ConfigRepository.Update`.

## Detailed module docs

- [`backend-architecture.md`](./backend-architecture.md) — layering, DI, domain services, use cases
- [`providers-and-resilience.md`](./providers-and-resilience.md) — provider pool, rate limiting, SSI cookies
- [`jobs-and-scheduling.md`](./jobs-and-scheduling.md) — cron jobs, registration, alert tick
- [`data-and-caching.md`](./data-and-caching.md) — stock metrics cache, concurrency contract
- [`frontend.md`](./frontend.md) — React SPA, API client, build/deploy

| Symbol | Why risky |
|--------|-----------|
| `MarketGateway` / `ProviderPool.FetchData` | Every analysis + refresh path depends on it |
| `StockMetricsUseCase` | Holds the RAM cache consumed lock-free by the 15s alert job |
| `Preparer.Prepare` | Shared by HTTP analyzer and all analysis jobs |
| `AlertEvaluator.Evaluate` | The single switch over `AlertType` in the whole codebase |
| `TradingConfig` aggregate | Persisted, read by every job's `GetAll` |

## Critical unknowns (verify before relying)

- **Unknown:** Mongo indexes on `bot_config` / `stock_metrics`. `GetAll` is called every
  alert tick (~15s). Verify: inspect repository code in `infrastructure/mongodb/*_repository.go`
  and Mongo `getIndexes()`. Impact: alert-tick latency under many configs.
- **Unknown:** Test coverage. No `_test.go` files surfaced in the file listing; `e2e/` exists
  at repo root. Verify: `find backend -name '*_test.go'` and inspect `e2e/`.
- **Unknown:** Alert auto-disable persistence race. `processConfig` sets `cond.Enabled=false`
  then `configRepo.Update`; concurrent config edits via the API could be clobbered (last-writer-wins). Verify: read `infrastructure/mongodb/config_repository.go` Update semantics.

## Priority recommendations for next work

1. Confirm Mongo indexing for the hot `ConfigRepository.GetAll` alert path — low effort, high impact on tick latency.
2. Add unit tests around `AlertEvaluator.Evaluate` and divergence detectors (pure functions, easy to test, high business value).
3. Document/guard the alert auto-disable update against concurrent API writes (optimistic version field).
