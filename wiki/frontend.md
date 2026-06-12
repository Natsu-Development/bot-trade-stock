---
title: "Frontend architecture"
tags: ["react", "typescript", "vite", "frontend"]
created: 2026-05-22
updated: 2026-06-11
sources: ["docs/frontend.md"]
category: architecture
confidence: high
schemaVersion: 1
---

# Frontend — vn-trading-terminal

React 18 + TypeScript + Vite SPA. Charting via `lightweight-charts`; styling via Tailwind v4 with
a neon-cyan theme. Radix UI primitives for dialogs/tooltips/selects/checkboxes.

## Structure

- `components/pages/` — **Dashboard, Screener, Analyze, Config, Settings** (five lazy-loaded pages).
  The nav's `analyze` page renders the `Divergence` component (`App.tsx`), which is the
  TradingView-style analyze view.
- `components/features/` —
  - Analyze: `PriceChart`, `AnalyzePage`, `AnalyzeWatchlistSidebar`, `SignalsTable`,
    `SymbolSearchInput`, `SymbolTag`.
  - Watchlist (renamed from "Stock Alerts"): `WatchlistSection`, `WatchlistRow`,
    `WatchlistEditorModal`, `WatchlistConditionDetail`, `WatchlistCategoryChips`,
    `WatchlistStatusBadge`.
  - Screener presets: `FilterPresetCard`, `MetricsFilterSection`.
- `components/screener/` — the tree **Query Builder** (`QueryBuilder`, `FilterGroup`,
  `FilterFormula`, `ColoredFormulaEditor`, `MetricPicker`, `MetricOption`), `SavedFilterChips`,
  `FilterBar`, `FilterPill`, `QuickPresets`, `ColumnSelector`, the virtualized
  `ScreenerResultsTable`, and the master-detail `SymbolDetailPanel`.
- `components/chart/` — `ChartControls`, `ChartLegend`, `CrosshairOverlay`, `IntervalSwitch`
  (`intervalOptions`).
- `components/ui/` — Radix-backed primitives: `button`, `dialog`, `select`, `checkbox`,
  `confirm-dialog`, `empty-state`, `skeleton`, `tooltip`, `badge`, `card`, `input`, `table`,
  `Toast`, `NumberInput`, `StatCard`.
- `hooks/` — feature-scoped: `chart/` (`useChartConfig`, `useChartControls`), `screener/`
  (`useScreenerFilters`, `useStockSelection`), plus `useDebounce`, `useSymbolAnalysis`,
  `useWatchlistQuotes`, `useClock`, `useConfigId`, `useNavigation`, `useTableColumns`.
- `lib/` — `api.ts` (singleton client), the screener filter model
  (`filterParse` / `filterSerialize` / `filterTreeOps`), `screenerFilterOptions`, `screenerUtils`,
  `trendlineUtils`, `rsiSeries`, `signalTargets`, the watchlist helpers
  (`watchlistMutations` / `watchlistOptions` / `watchlistStyles`), `authGate`, `errors`, `version`,
  `utils`.
- `types/`, `styles/`.

## Screener filter model (tree in the UI, flat normal form on the wire)

The UI edits the filter as a **tree** (`FilterTreeNode`, mutated via `lib/filterTreeOps.ts`) — a
root combinator (`and`/`or`) over leaf conditions and one level of groups, with optional negation.
Before calling the API it is **serialized to the backend's flat two-level normal form**
(`lib/filterSerialize.ts` → `{match, negate?, conditions[], groups[], exchanges[]}`) and parsed back
with `lib/filterParse.ts`. A condition is `{field, op, value}` or, for a field-vs-field comparison
(e.g. `ema_9 > ema_21`, `current_price < ema_50`), `{field, op, rhs_field}`. The UI restricts the
operator set per field kind to mirror the backend's `Condition.validate`:

- **integer** (`rs_1m..rs_52w`, `current_volume`, `volume_sma20`): `>`, `>=`, `<`, `<=`
- **float** (`current_price`, `price_change_pct`, `volume_vs_sma`): `>`, `<`
- **signal** (`has_*` booleans): `=` with `true`/`false`
- **moving average** (`ema_9/21/50`, `sma_200`): compared only against price or another MA via
  `rhs_field`

`SavedFilterChips` show the loaded preset and a "modified" state once the tree is edited.

## Screener UX (master-detail + virtualization)

The screener is a split master-detail layout: the virtualized results table
(`ScreenerResultsTable`, backed by `@tanstack/react-virtual`) on one side and a collapsible
`SymbolDetailPanel` (reusing `PriceChart`) on the other. The table virtualizes rows so large
result sets stay responsive; the detail chart stays mounted to avoid remount cost.

## Analyze page (TradingView-style)

The Analyze view (`Divergence` page → `AnalyzePage`) pairs an `AnalyzeWatchlistSidebar` with a hero
`PriceChart` and an RSI sub-pane. RSI is derived client-side via `lib/rsiSeries.ts` from the
`/analyze/:symbol` response (`price_history[].rsi`), and `hooks/useSymbolAnalysis` drives the
per-symbol fetch. `IntervalSwitch` changes the chart cadence.

## API client (`frontend/src/lib/api.ts`)

Single `ApiClient` class over `fetch`, base URL `VITE_API_URL` (default `http://localhost:8080`). It
carries a **config ID** identifying the user's trading config, persisted in `localStorage` under
`trading-app_config-id` (`CONFIG_ID_STORAGE_KEY`); lazy init avoids hydration mismatches. Because
signals are **per-config**, the screener endpoints append it: `filterStocks` →
`POST /stocks/filter?config_id=…` and `recomputeStocks` → `POST /stocks/recompute?config_id=…`.
`getConfig`/`updateConfig` manage the per-user config (including its `watchlist`), and
`analyzeSymbol`/`analyzeSignals` hit `/analyze/:symbol`.

Response shapes mirror backend DTOs — e.g. `ApiStockMetrics` maps the screener fields
(`rs_1m..rs_52w`, `volume_sma20`, `has_*` signal booleans), and `ApiFilterRequest` mirrors the flat
filter value object (`match`/`conditions`/`groups`/`rhs_field`/`exchanges`). This TS↔Go contract is
maintained **by hand** — no codegen — so it can drift if backend DTO JSON tags change.

## Navigation & state

No router library — a hand-rolled `useNavigation` hook routes five lazy-loaded pages
(`frontend/src/App.tsx`). State is React hooks + localStorage; "auth" is a config-ID gate via
`UsernameDialog`, with `lib/authGate.ts` (`dataPagesReady`) deciding when the data pages may render.

## Build & deploy

`tsc && vite build`. The built static site is served by the **nginx** container, which also
terminates TLS and reverse-proxies the API. `VITE_APP_VERSION` stamps the build (`lib/version.ts`).

## Failure modes

| Failure | Symptom | Note |
|---------|---------|------|
| `localStorage` disabled (incognito) | Falls back to in-memory config ID | Handled with try/catch in `api.ts` |
| API unreachable | fetch rejects | Check nginx → bot-trade proxy + `/health` |
| Cache warming (`/stocks/filter` 503) | Empty screener until the refresh job warms the cache | `ErrCacheNotReady`; retry after the boot refresh |
| Wrong `VITE_API_URL` at build | All calls hit wrong host | Set at build time, not runtime |

## Unknowns
- **Unknown:** error-to-UI mapping and retry/loading UX. Verify: `lib/errors.ts` and the page components.
- **Unknown:** whether nginx config rewrites API paths or expects same-origin. Verify: the nginx config baked into the frontend image.
