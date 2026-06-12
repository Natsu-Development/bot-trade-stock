---
title: "ADR 0003: Flat two-level screener filter (normal form)"
tags: ["screener", "filter", "value-object", "shared-kernel", "normal-form"]
created: 2026-06-03T00:00:00.000Z
updated: 2026-06-11T00:00:00.000Z
sources:
  - "backend/domain/shared/valueobject/filter/stock_filter.go"
  - "backend/domain/shared/valueobject/filter/group.go"
  - "backend/domain/shared/valueobject/filter/condition.go"
  - "backend/domain/shared/valueobject/filter/field.go"
  - "backend/domain/shared/valueobject/filter/operator.go"
  - "backend/domain/shared/valueobject/filter/match.go"
  - "backend/domain/metrics/service/filterer.go"
  - "backend/presentation/http/handler/stock.go"
links:
  - "data-and-caching.md"
  - "project-overview.md"
category: decision
confidence: high
schemaVersion: 1
---

# ADR 0003: Flat two-level screener filter (normal form)

## Status
Accepted (shipped on `enhance/filter-revamp`). Replaces the recursive `FilterNode`
(react-querybuilder) screener-filter model.

## Context
The screener filter was a single recursive value object (`FilterNode`, react-querybuilder shape),
capped at `MaxFilterDepth = 3`. In practice a group at depth 2 could only hold leaves, so the
"recursive" model was already **root + one level of groups**. Two maintainability pains:

1. **Recursive tree shape** — a `rules[]` array mixed leaf conditions and sub-groups, so the same
   element could be either thing; raw MongoDB documents were hard to scan.
2. **One struct, three roles, no type safety** — the same `FilterNode` was the JSON wire shape, the
   BSON storage shape, and the domain model; the "a node is either a rule or a group" invariant was
   enforced only at runtime (`Validate`).

## Decision
Replace it with a **flat, two-level normal form** in `backend/domain/shared/valueobject/filter/`,
with distinct types so rule-vs-group ambiguity is impossible by construction:

- **`StockFilter`** — top-level `Match` (`MatchMode`) over `Conditions[]` and `Groups[]`, optional
  `Negate`, plus an outer-AND `Exchanges[]` (never negated).
- **`Group`** — one level of grouping: `Match` + optional `Negate` over `Conditions[]` only. **No
  sub-groups** — the model is bounded to two levels by construction.
- **`Condition`** — a single leaf: `Field`, `Op`, `Value`, and an optional `RhsField`.

Key properties:

- **One representation, no mapper** — the flat shape is simultaneously the JSON wire shape, the BSON
  storage shape, and the domain model (native (un)marshaling; no DTO↔domain mapper on the backend).
- **`MatchMode` is `"and"` / `"or"`** (`match.go`). (The original design draft used `all`/`any`; the
  shipped wording is `and`/`or`.)
- **Per-field-kind operator rules**, enforced in `Condition.validate` and mirrored in the FE:

  | Field kind | Fields | Operators |
  |---|---|---|
  | float | `current_price`, `price_change_pct`, `volume_vs_sma` | `>`, `<` (strict — floats never land exactly on a threshold) |
  | integer | `rs_1m..rs_52w`, `current_volume`, `volume_sma20` | `>`, `>=`, `<`, `<=` (`=` rejected — always-false footgun) |
  | signal | `has_breakout_potential/confirmed`, `has_breakdown_potential/confirmed`, `has_bullish_rsi`, `has_bearish_rsi` | `=` with a bool value (nil → false) |
  | moving average | `ema_9`, `ema_21`, `ema_50`, `sma_200` | only via `RhsField` (see below) |

- **Field-vs-field comparison via `RhsField`** — when `RhsField` is set the condition compares two
  price/MA fields (e.g. `ema_9 > ema_21`, `current_price < ema_50`); both sides must be price-or-MA
  and distinct, `Op ∈ {>, <}`, and `Value` must be nil. A bare moving-average leaf **without**
  `RhsField` is rejected (an MA is only meaningful compared to price or another MA).
- **Global cap** — `MaxFilterConditions` bounds the total leaf count (defense-in-depth alongside the
  256 KiB request-body cap in `stock.go`).
- **Clean break, no migration** — old presets are abandoned at cutover; there is no read-time upcast.
- **Frontend keeps a tree** (`lib/filterTreeOps.ts`) for editing and **serializes to this flat NF**
  (`lib/filterSerialize.ts` / `filterParse.ts`).

## Rejected alternatives
- **Keep the recursive `FilterNode` tree.** Rejected — the rule-xor-group ambiguity and unreadable
  Mongo documents were the whole motivation; the depth-3 cap meant recursion bought no real
  expressiveness.
- **Separate `num` / `signal` value keys per condition.** Rejected — reuse the existing `FilterValue`
  VO (number, or bool→`1/0`); the pains were structural, not value-typing.
- **`all` / `any` combinator wording.** Considered in the design draft; shipped as `and` / `or`.
- **Keep float `=` / `>=` / `<=`.** Rejected for floats — equality on a continuous value is a silent
  always-false footgun; floats use strict `>` / `<` only.

## Consequences / invariants
- **Branch-order invariant.** `Condition.validate` checks the `RhsField` (field-comparison) case
  FIRST so a price/MA LHS routes there rather than to the legacy moving-average branch; the matcher's
  `evalCondition` (`domain/metrics/service/filterer.go`) **must mirror this branch order**.
- **Two levels by construction** — a `Group` cannot hold a `Group`, so depth can never exceed two; no
  runtime depth validator is needed.
- **Wire shape** (see the test-api runbook): `{match, negate?, conditions[], groups[], exchanges[]}`;
  `POST /stocks/filter` requires `config_id` (signals are per-config — see
  [data-and-caching.md](data-and-caching.md)).
