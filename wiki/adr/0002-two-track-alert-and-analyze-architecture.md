---
title: "ADR 0002: Two-track alert + analyze job architecture"
tags: ["alert", "analyze", "stock-alert", "rsi-divergence", "trendline", "session-gate", "auto-disable", "arrayfilter", "job-registry", "alert-evaluator", "intact-filter"]
created: 2026-05-27T00:00:00.000Z
updated: 2026-05-27T14:55:00.000Z
sources:
  - "bot-trade/application/jobs/alert/stock_alert_job.go"
  - "bot-trade/application/jobs/analyze/base.go"
  - "bot-trade/application/jobs/analyze/bullish_rsi_job.go"
  - "bot-trade/application/jobs/analyze/bearish_rsi_job.go"
  - "bot-trade/application/jobs/analyze/breakout_job.go"
  - "bot-trade/application/jobs/analyze/breakdown_job.go"
  - "bot-trade/application/jobs/registry/factory.go"
  - "bot-trade/application/service/condition_disabler.go"
  - "bot-trade/application/usecase/stock_metrics.go"
  - "bot-trade/domain/analysis/service/signal_generator.go"
  - "bot-trade/domain/analysis/service/trendline_filter.go"
  - "bot-trade/domain/config/aggregate/trading_config.go"
  - "bot-trade/domain/config/service/alert_evaluator.go"
  - "bot-trade/domain/config/valueobject/stock_alert_config.go"
  - "bot-trade/domain/metrics/aggregate/stock_metrics.go"
  - "bot-trade/domain/shared/valueobject/market/session.go"
  - "bot-trade/infrastructure/mongodb/config_repository.go"
links:
  - "jobs-and-scheduling.md"
  - "backend-architecture.md"
  - "adr/0001-use-host-side-ssi-cookie-refresh.md"
category: decision
confidence: high
schemaVersion: 1
---

# ADR 0002: Two-track alert + analyze job architecture

## Status
Accepted.

## Context
A single user-configured alert list has to serve two very different evaluation
budgets:

- **Sub-minute, real-time signal-on-quote.** Price/volume/MA-cross/single-timeframe
  trendline-approach conditions need to fire within a tick of the underlying
  event. Inputs are the live `ssi-quote` map and pre-computed daily metrics —
  cheap, evaluated against every symbol every tick.
- **Heavy OHLCV pull + multi-timeframe analysis.** RSI divergence and
  multi-timeframe trendline detection require pulling per-interval candle
  history for each symbol and running geometric/pivot analysis. Far too
  expensive to do on a 15-second tick, but stale by the next trading session
  if done once a day.

A second tension: when an alert fires, the next snapshot of the config doc
should reflect the fire (auto-disable so the user isn't spammed). With both
tracks writing to the same Mongo document concurrently — and the tick alert
job mutating it dozens of times per minute — a naive read-modify-write would
clobber sibling conditions auto-disabled by the other track between read and
write.

A third tension: the `ssi-quote` provider returns stale data outside HoSE's
intraday quote window (ATO call auction, lunch break, post-close). Firing
alerts on that stale window produces ghost signals and wastes provider quota.

## Decision

Split alert evaluation into two independent tracks with a shared config model
and a shared scoped-write seam:

1. **Tick alert job** (`bot-trade/application/jobs/alert/stock_alert_job.go`)
   runs on a fast cron (default 15s) gated by `IsHoSEActiveQuoteWindow`. It
   fetches all `ssi-quote` quotes once, loads every `TradingConfig` once, and
   for each enabled non-`IsAnalyzeOnly()` condition calls the `AlertEvaluator`
   domain service. Fired conditions get auto-disabled via `ConditionDisabler`.

2. **Analyze jobs** (`bot-trade/application/jobs/analyze/*.go`) — bullish_rsi,
   bearish_rsi, breakout, breakdown — run on a slower per-interval cron,
   pull fresh OHLCV via the `MarketGateway`/`Preparer`, and detect divergence /
   multi-timeframe trendline signals. Each job derives its symbol set
   dynamically from `cfg.SymbolsWithEnabledCondition(<type>)`. Fired signals
   get auto-disabled via the same `ConditionDisabler`.

3. **Single `AlertCondition` taxonomy with `IsAnalyzeOnly()` classifier**
   (`bot-trade/domain/config/valueobject/stock_alert_config.go`). The fourteen
   condition types partition cleanly:

   | Track | Types |
   |---|---|
   | Tick evaluator (`!IsAnalyzeOnly()`) | `price_above`, `price_below`, `volume_spike`, `transaction_volume_spike`, `trendline_breakout`, `trendline_breakdown`, `price_cross_above`, `price_cross_below` |
   | Analyze jobs (`IsAnalyzeOnly()`) | `bullish_divergence`, `bearish_divergence`, `bullish_divergence_early`, `bearish_divergence_early`, `trendline_breakout_mtf`, `trendline_breakdown_mtf` |

   The tick path explicitly skips analyze-only types at
   `stock_alert_job.go:165` so adding a divergence condition to a user's
   alerts cannot fire on the tick path even by accident.

4. **`ConditionDisabler` is the only auto-disable seam.** Both tracks call
   `disabler.Disable(ctx, configID, symbol, cond)`, which delegates to
   `ConfigRepository.SetConditionEnabled`. That method uses a Mongo
   `arrayFilter`-scoped `$set` (`infrastructure/mongodb/config_repository.go`)
   so the write touches only the matching condition — never the surrounding
   document. Concurrent writers on different conditions of the same config
   never collide; concurrent writers on the *same* condition resolve to the
   same final state (disabled).

5. **Session gate lives at the job boundary, not inside the evaluator.**
   `StockAlertJob.Execute` returns early outside the HoSE quote window. The
   `AlertEvaluator` itself is time-of-day-naive (testable, deterministic).
   Override is one env var: `STOCK_ALERT_IGNORE_SESSION_GATE=true` for
   dev/demo.

6. **Job factory registry.** Every job file calls
   `registry.RegisterFactory(<name>, <factory>)` in `init()`. Wire iterates
   `GlobalRegistry().AllFactories()` and feeds each factory the same
   `JobDependencies` struct (`bot-trade/application/jobs/registry/factory.go`).
   Adding a job is a single file with an `init()` — no central wiring edit.

## Rejected alternatives

- **One uber-job that evaluates all types every tick.** Rejected: pulling
  per-interval OHLCV for divergence on a 15-second cron would saturate the
  market-data providers and the bot's CPU.
- **Two separate config models (one for tick, one for analyze).** Rejected:
  doubles the user-facing config surface, duplicates symbol lists, and breaks
  the "one place to enable/disable a signal for FPT" mental model.
- **Whole-document optimistic write with retry.** Rejected: the alert tick
  job runs many writes per tick across many configs; OCC retry storms during
  morning-bell bursts would compound the tick-timeout risk. The
  `arrayFilter`-scoped write avoids the problem structurally — no collision,
  no retry.
- **Session gate inside each `case` of the evaluator switch.** Rejected:
  duplicates the gate across every fire path and entangles a time-of-day
  concern with the pure fire/no-fire rule. The boundary gate at
  `Execute` is testable as one decision instead of N.
- **Reactive enable/disable from the analyze job back to the tick job
  in-memory.** Rejected: makes the two tracks stateful with each other.
  Routing all disables through Mongo keeps the tracks independent — restart
  either one and the other still sees the disabled state.

## Consequences

- **Two cron lanes to monitor**: the alert job's tick timeout
  (`STOCK_ALERT_TIMEOUT_MINUTES`) and each analyze job's per-interval
  timeout. They share telemetry tags via `tracker.EndRequest` but their
  failure modes are independent (alert can be healthy while analyze is
  stuck on a slow gateway).
- **Adding a new condition type requires two decisions**: (a) which track
  owns it, encoded via `IsAnalyzeOnly()`; (b) which fire/no-fire rule lives
  in `AlertEvaluator` or which detector emits the `analysisvo.Signal*Type`.
  Cross-track misclassification is the most likely future bug — covered by
  the `stock_alert_job.go:165` skip guard and the analyze base's typed
  `disableType` field.
- **Per-condition write is the contract for auto-disable**, not whole-doc
  update. Any new code path that disables a condition MUST go through
  `ConditionDisabler`. Whole-doc PUT continues to work for user edits via
  `TradingConfig.Merge`.
- **`ResistanceLevel` / `SupportLevel` on `StockMetrics` are single-consumer**
  fields produced by the refresh job for the tick evaluator's
  `trendline_breakout` / `trendline_breakdown` cases. The analyze jobs do
  NOT consume them — they build their own per-interval trendlines from
  fresh OHLCV. The screener uses `HasBreakoutPotential` /
  `HasBreakoutConfirmed` booleans (independent path through
  `signal_generator.go`).
- **Lifespan-intact filter precedes the nearest-level pick.** Before
  `nearestPotential{Resistance,Support}Level` runs, the refresh job calls
  `analysissvc.FilterIntactTrendlines(lines, recentData)`. A line is dropped
  if `bar.Close` ever crossed `line.PriceAt(bar.Index)` on its breakage side
  between `EndPivot.Index+1` and the latest bar — the same predicate
  `findCrossingPoint{Above,Below}` already use to emit `*_Confirmed`
  signals. Without this filter a broken-then-pulled-back line would
  re-qualify as nearest once `latestClose` drifted back inside the band,
  firing a phantom POTENTIAL alert. The Confirmed-signal emission path is
  unchanged — broken lines still emit `*_Confirmed` at the breakout bar.
- **HoSE session gate is a hard skip**. Outside the gate the alert job
  returns `nil` early; no fetch, no evaluator call, no disable. The
  refresh job and analyze jobs continue running on their own schedules
  unaffected.
- **Vietnamese holidays are out of scope** for the session gate (see
  `session.go`). On Tet and other market holidays the gate still admits
  the weekday window — `ssi-quote` returns the previous session's data
  but no new signals form.

## Implementation flow

### Track 1: tick alert job
1. Cron fires `StockAlertJob.Execute` on `STOCK_ALERT_SCHEDULE`
   (default `*/15 * * * * 1-5`, weekday gate baked into the cron itself).
2. `IsHoSEActiveQuoteWindow(j.now(), j.marketTz)` gates: returns `nil`
   silently outside `09:00–11:30` and `13:00–14:45` ICT (HoSE intraday
   continuous-matching window).
3. `quoteProvider.FetchAllQuotes(ctx)` returns the full
   symbol→`MarketQuote` map (HOSE + HNX + UPCOM in one call).
4. `metricsManager.MetricsBySymbol()` returns the shared lock-free metrics
   map (refresh job is the producer; may be `nil` before first warm).
5. Reference-swap of `j.prevQuotes` under a mutex so every condition in a
   tick reads the same previous-tick snapshot — guarantees the
   `TransactionVolumeSpike` delta is consistent across an alert's conditions.
6. For each `TradingConfig`, for each `StockAlert`, for each enabled
   non-`IsAnalyzeOnly()` `AlertCondition`: call
   `AlertEvaluator.Evaluate(cond, quote, prev, metrics)`.
7. If any condition fires, build one notification message with all fired
   fields, `notifier.Send(ctx, cfg.Telegram, msg)`.
8. On send success, `disabler.Disable(ctx, configID, symbol, cond)` for every
   fired condition. Send failure halts the disable loop for that alert so a
   missed Telegram doesn't silently kill the user's monitoring.

### Track 2: analyze jobs
1. Each analyze cron fires `AnalysisJob.Execute(ctx)` (see
   `bot-trade/application/jobs/analyze/base.go`).
2. Selector closure `selectSymbols(cfg)` calls
   `cfg.SymbolsWithEnabledCondition(<type>)` for the job's bound type
   (e.g., `AlertTypeBullishDivergence`). Symbols with the condition
   disabled — including conditions auto-disabled by a previous fire — are
   skipped.
3. `errgroup` with bounded concurrency runs `analyze(...)` per symbol.
4. `analyze` calls `Preparer.Prepare(symbol, interval)` to pull fresh
   OHLCV, runs the strategy (`appUsecase/analyze/rsi`, `.../trendline`),
   returns `(msg, fired, err)`. `withinSignalWindow(date, cfg.SignalDaysThreshold)`
   filters out signals older than the configured recency window.
5. On `fired == true`: `notifier.Send(...)`, then
   `disabler.Disable(ctx, configID, symbol, cond)` with
   `disableType` from the job's factory (`AlertTypeBullishDivergence`,
   `AlertTypeBreakoutMTF`, etc.).

### Shared: scoped per-condition disable
1. `ConditionDisabler.Disable(ctx, configID, symbol, cond)` →
   `repo.SetConditionEnabled(ctx, configID, symbol, cond, false)`.
2. `MongoConfigRepository.SetConditionEnabled` issues `UpdateOne` with an
   `arrayFilters` clause that targets only `(symbol == s, type == t,
   reference == r)`. The `$set` payload writes a single
   `alerts.$[a].conditions.$[c].enabled = false` — never `alerts: <whole array>`.
3. Concurrent disables on different (symbol, type) pairs of the same
   document compose cleanly. Concurrent disables on the *same* condition
   resolve idempotently (already-false stays false).

## Job catalog

| Cron job | File | Track | Disable type | Symbol selector |
|---|---|---|---|---|
| `stock-alert` | `application/jobs/alert/stock_alert_job.go` | Tick | per-fired-condition (from the fired condition itself) | iterates every config's `Alerts` directly |
| `bullish-rsi-<interval>` | `application/jobs/analyze/bullish_rsi_job.go` | Analyze | `AlertTypeBullishDivergence` | `SymbolsWithEnabledCondition(AlertTypeBullishDivergence)` |
| `bullish-rsi-early-<interval>` | same | Analyze | `AlertTypeBullishDivergenceEarly` | `SymbolsWithEnabledCondition(AlertTypeBullishDivergenceEarly)` |
| `bearish-rsi-<interval>` | `application/jobs/analyze/bearish_rsi_job.go` | Analyze | `AlertTypeBearishDivergence` | `SymbolsWithEnabledCondition(AlertTypeBearishDivergence)` |
| `bearish-rsi-early-<interval>` | same | Analyze | `AlertTypeBearishDivergenceEarly` | `SymbolsWithEnabledCondition(AlertTypeBearishDivergenceEarly)` |
| `breakout-<interval>` | `application/jobs/analyze/breakout_job.go` | Analyze | `AlertTypeBreakoutMTF` | `SymbolsWithEnabledCondition(AlertTypeBreakoutMTF)` |
| `breakdown-<interval>` | `application/jobs/analyze/breakdown_job.go` | Analyze | `AlertTypeBreakdownMTF` | `SymbolsWithEnabledCondition(AlertTypeBreakdownMTF)` |
| `stock-refresh` | `application/jobs/refresh/stock_refresh_job.go` | (not an alert) — produces `StockMetrics` consumed by the tick evaluator's trendline-potential cases | — | — |

The bullish/bearish RSI factories instantiate one job per configured interval
under `STOCK_ANALYZE.<bullish/bearish>.intervals`. Same for breakout/breakdown.
Adding a new interval is config-only.

## Key files

- **Tick path**
  - `bot-trade/application/jobs/alert/stock_alert_job.go` — Execute, session
    gate, prev-quote swap, per-condition fire+notify+disable loop.
  - `bot-trade/domain/config/service/alert_evaluator.go` — pure fire/no-fire
    rule per `AlertType`. No I/O, no time-of-day. Test seam.
  - `bot-trade/domain/shared/valueobject/market/session.go` —
    `IsHoSEActiveQuoteWindow`; HoSE 09:00–11:30 / 13:00–14:45 ICT.
- **Analyze track**
  - `bot-trade/application/jobs/analyze/base.go` — generic `AnalysisJob`,
    selector closure pattern, `withinSignalWindow`, per-symbol errgroup,
    `firstSignalOfType`.
  - `bot-trade/application/jobs/analyze/{bullish,bearish}_rsi_job.go` — RSI
    divergence factories; one job per interval per confirmed/early variant.
  - `bot-trade/application/jobs/analyze/{breakout,breakdown}_job.go` —
    multi-timeframe trendline factories.
  - `bot-trade/application/usecase/analyze/{rsi,trendline}/*.go` — pure
    detection logic invoked by the analyze strategies.
- **Shared**
  - `bot-trade/application/service/condition_disabler.go` — single seam for
    auto-disable; identity `(configID, symbol, type, reference)`.
  - `bot-trade/domain/config/valueobject/stock_alert_config.go` — `AlertType`,
    `IsDivergence`, `IsTrendlineMTF`, `IsAnalyzeOnly`, `RequiresThreshold`,
    `RequiresReference`. The taxonomy and its classifiers.
  - `bot-trade/domain/config/aggregate/trading_config.go` —
    `SymbolsWithEnabledCondition(t)` powers analyze-job symbol selection;
    `Merge` enforces partial-PUT contract.
  - `bot-trade/infrastructure/mongodb/config_repository.go` —
    `SetConditionEnabled` (scoped arrayFilter `$set`); `GetByID`, `GetAll`.
  - `bot-trade/application/jobs/registry/factory.go` — `JobDependencies`,
    `JobRegistry`, `RegisterFactory`, `GlobalRegistry`.
- **Bridge metrics** (refresh-job-produced, tick-evaluator-consumed)
  - `bot-trade/application/usecase/stock_metrics.go` —
    `computeSignals` runs `FilterIntactTrendlines` against `recentData` to
    drop lines pierced by `Close` since their `EndPivot`, then calls
    `nearestPotentialResistanceLevel` / `nearestPotentialSupportLevel` on
    the surviving set. The single-bar guards inside the nearest-helpers
    (`level < latestClose` / `level > latestClose`) remain as
    defense-in-depth.
  - `bot-trade/domain/analysis/service/trendline_filter.go` —
    `IsIntact(line, bars)` boolean predicate and `FilterIntactTrendlines`
    slice wrapper. Delegates to the unexported `findCrossingPoint{Above,
    Below}` in `signal_generator.go` so the "broken vs intact" predicate
    has one source of truth across the Confirmed-signal path and the
    level-extraction path. Detection is Close-based (symmetric); line
    construction is asymmetric (`priceFor` reads Low for support pivots,
    High for resistance pivots).
  - `bot-trade/domain/metrics/aggregate/stock_metrics.go` — `ResistanceLevel`,
    `SupportLevel`, `TrendlineProximity`. Response-only, NOT in the screener
    filter whitelist.

## Important gotchas

- **The tick path silently skips `IsAnalyzeOnly()` types** at
  `stock_alert_job.go:165`. A divergence condition will never fire on the
  tick path even if a future bug makes its evaluator returnable.
- **`AlertEvaluator` is the only place fire/no-fire lives** for tick types.
  Do not add fire logic inside `stock_alert_job.go` itself — the job is
  intentionally a coordinator, not a decider.
- **Scoped writes are mandatory** for auto-disable. Any new disable path
  MUST go through `ConditionDisabler`. A whole-doc `UpdateConfig` from a
  fired-alert path would race with the other track.
- **Session gate is HoSE-only** by design. HNX and UPCOM symbols also go
  silent during the same window in practice, so a single gate suffices.
  Vietnamese holidays are not encoded; the cron's `1-5` weekday field
  handles weekends only.
- **`prevQuotes` reference-swap under mutex** guarantees per-tick
  consistency: every condition in the same `Execute` call sees the same
  prev snapshot. Do not move the swap inside the alert loop.
- **`StockMetrics.{Resistance,Support}Level == 0`** is the "no qualifying
  line" signal — the evaluator suppresses the alert (lines 89 and 103 of
  `alert_evaluator.go`). After a clean breakout-through-all-known-resistance,
  ResistanceLevel is intentionally zero until the next refresh discovers
  new pivots above the new high. Zero is also the result when every
  candidate line was broken along its post-`EndPivot` lifespan; see the
  lifespan-intact filter bullet in *Consequences* for the predicate.
- **Analyze jobs use their own per-interval trendlines**, not the tick
  evaluator's bridge metrics. Do not unify the two — they answer different
  questions (single-timeframe approach band vs multi-timeframe break-confirm).
- **`SymbolsWithEnabledCondition` is the load-bearing seam** for analyze
  symbol-set updates. Enabling a condition on a config means the next
  analyze cron tick picks up the symbol; disabling means the symbol drops
  from the next tick's set. No restart needed.

## Manual verification commands

```bash
# Compile + unit tests for the alert/analyze layer
cd bot-trade
go test ./application/jobs/alert/... ./application/jobs/analyze/... \
        ./domain/config/service/... ./domain/config/aggregate/... \
        ./application/service/...

# Trace a single tick locally (requires running services)
docker logs trading-bot 2>&1 | grep -E '(stock-alert|stock alert)'

# Inspect a config's enabled conditions
mongosh --eval 'db.bot_config.findOne({_id:"system"}).alerts'

# Verify a fired condition was scoped-disabled, not whole-doc clobbered
mongosh --eval 'db.bot_config.findOne({_id:"system"}).alerts[0].conditions'

# Trigger the HoSE session gate (dev only)
STOCK_ALERT_IGNORE_SESSION_GATE=true ./bot-trade
```

## Related pages

- [Jobs and scheduling](../jobs-and-scheduling.md) — cron lanes, timeouts,
  per-job schedules.
- [Backend architecture](../backend-architecture.md) — DDD layers, port/
  adapter boundaries, where alert + analyze sit.
- [ADR 0001: Use host-side SSI cookie refresh](0001-use-host-side-ssi-cookie-refresh.md) —
  the `ssi-quote` provider this track depends on; the SIGHUP-driven
  credential reload underneath the tick job.
