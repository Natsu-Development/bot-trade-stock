---
title: "ADR 0004: Fixed analysis window (ANALYSIS_WINDOW_BARS)"
tags: ["analysis-window", "lookback", "config", "interval-scaling", "no-system"]
created: 2026-06-04T00:00:00.000Z
updated: 2026-06-11T00:00:00.000Z
sources:
  - "backend/domain/shared/valueobject/market/interval.go"
  - "backend/config/config.go"
  - "backend/application/usecase/metrics/refresh.go"
  - "backend/application/jobs/analyze/base.go"
  - "backend/wire/app.go"
  - "backend/wire/pres.go"
links:
  - "data-and-caching.md"
  - "jobs-and-scheduling.md"
category: decision
confidence: high
schemaVersion: 1
---

# ADR 0004: Fixed analysis window (`ANALYSIS_WINDOW_BARS`)

## Status
Accepted (shipped). Removes both `LookbackDay` and `IndicesRecent` in favour of one
operator-level constant. Ties into the no-`system` per-config redesign (see ADR-0002's amendment).

## Context
The trading config exposed two coupled knobs that were two **units for one idea** ("how much recent
history to look at"):

- **`LookbackDay`** — a *calendar-day* fetch window (`start = end − days`), interval-scaled.
- **`IndicesRecent`** — a *bar-count* analysis window: after RSI was computed over the full fetch, the
  last `IndicesRecent` bars were sliced and all analysis (divergence, trendline, RS/volume) ran on
  that slice.

Both were user-editable in two places — the per-user `TradingConfig` **and** a singleton `"system"`
config doc — and a misconfigured pair silently starved or distorted analysis.

## Decision
Replace both with **one operator-level constant**:

- **`ANALYSIS_WINDOW_BARS`** (default **250**), **env-overridable**, loaded once at the composition
  root into `config.AnalysisWindowBars` — **not** a user/per-config surface. It is injected as
  `windowBars` into the analyze `Preparer` (`wire/pres.go`), the metrics `UseCase` (`wire/app.go`),
  and the analyze jobs (`jobs/analyze/base.go`).
- **Fetch span = interval-scaled** via `market.FetchSpanForBars(interval, windowBars)`
  (`interval.go`) — a fixed bar count converted to a calendar-day span per cadence, reusing the
  existing machinery. The all-equity refresh fetches `FetchSpanForBars(Interval1D, windowBars)`
  (`metrics/refresh.go`).
- **No trim** — the full fetched window **is** the analysis window. The exact-bar-count slice was
  removed. The chart is unchanged (renders the full series).
- **Clean break** — the two fields are dropped from the request and response DTOs; the frontend
  controls are removed; stale Mongo fields are ignored (we control all consumers). The singleton
  `"system"` config doc is removed entirely.

## Rejected alternatives
- **Exact-bar-count trim (slice last `N` after RSI).** Would make the window deterministic (exactly
  `N`) and discard RSI warm-up bars. **Rejected for simplicity** — the smaller change was chosen.
  Accepted consequence: the window is the fuzzy fetched count (~`N` ± holidays) and RSI warm-up bars
  enter analysis (shown safe).
- **Native provider `countback`.** A datafeed could prioritize a fixed bar count over `from`/`to`,
  which validated the bar-count *intent* — but our providers can't honor it: `MarketGateway.FetchData`
  is `from`/`to` only, VietCap is non-UDF, SSI/VPS send `from`/`to`, and the pool fails over across
  them. **Rejected — infeasible.**
- **Two independent constants (deep fetch + recent analysis)** and a **shared `RecentRSIWindow`
  helper.** Both unnecessary once the trim was dropped — one window serves fetch and analysis.

## Consequences
- One unit, one place: an operator tunes `ANALYSIS_WINDOW_BARS` without recompile; users no longer see
  a lookback knob.
- The window is **fuzzy** (~`N` ± holidays per interval) rather than an enforced bar count.
- Removing the `"system"` config doc is a prerequisite shared with the per-config metrics redesign —
  every config-derived value is now per-user (ADR-0002 amendment, [data-and-caching.md](data-and-caching.md)).
