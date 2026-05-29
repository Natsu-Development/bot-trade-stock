---
title: "Frontend architecture"
tags: ["react", "typescript", "vite", "frontend"]
created: 2026-05-22
updated: 2026-05-22
sources: ["docs/frontend.md"]
category: architecture
confidence: high
schemaVersion: 1
---

# Frontend — vn-trading-terminal

React 18 + TypeScript + Vite SPA. Charting via `lightweight-charts`; styling via Tailwind v4 with
a neon-cyan theme. Radix UI primitives for dialogs/tooltips/switches.

- `components/pages/` — Dashboard, Screener, Divergence, Config/Settings.
- `components/features/` — PriceChart, SearchBox, SignalCard, etc.
- `components/chart/`, `components/screener/`, `components/layout/`, `components/ui/`.
- `hooks/` — feature-scoped: `chart/` (config, controls, keyboard), `screener/` (filters, selection), plus `useClock`, `useConfigId`, `useNavigation`, `useTableColumns`.
- `lib/` — `api.ts` (singleton client), filter/trendline/screener utils, `errors.ts`, `version.ts`.
- `types/`, `styles/`.

## API client (`frontend/src/lib/api.ts`)

Single `ApiClient` class (`:315`) over `fetch`, base URL `VITE_API_URL` (default
`http://localhost:8080`, `:2`). It carries a **config ID** identifying the user's trading config,
persisted in `localStorage` under `trading-app_config-id` (`:4-58`). The default config ID seeds
the analysis endpoint (`/analyze/:symbol` uses it to resolve RSI/divergence params server-side).
Lazy init avoids hydration mismatches.

Response shapes mirror backend DTOs — e.g. `ApiStockMetrics` (`:61-94`) maps the screener fields
(`rs_1m..rs_52w`, `volume_sma20`, `has_*` signal booleans), and `ApiFilterRequest`/`ScreenerFilterPreset`
(`:96-112`) mirror the backend filter value objects. This TS↔Go contract is maintained by hand —
no codegen — so it can drift if backend DTO JSON tags change.

## Navigation & state

No router library — a hand-rolled `useNavigation` hook routes five lazy-loaded pages
(`frontend/src/App.tsx:9-49`). State is React hooks + localStorage; "auth" is a config-ID gate
via `UsernameDialog` (`App.tsx:32-37`).

## Build & deploy

`tsc && vite build` (`frontend/package.json`). The built static site is served by the **nginx**
container, which also terminates TLS and reverse-proxies the API. `VITE_APP_VERSION` stamps the
build (`lib/version.ts`).

## Failure modes

| Failure | Symptom | Note |
|---------|---------|------|
| `localStorage` disabled (incognito) | Falls back to in-memory config ID | Handled with try/catch (`api.ts:28,44`) |
| API unreachable | fetch rejects | Check nginx → bot-trade proxy + `/health` |
| Wrong `VITE_API_URL` at build | All calls hit wrong host | Set at build time, not runtime |

## Unknowns
- **Unknown:** error-to-UI mapping and retry/loading UX. Verify: `lib/errors.ts` and the page components.
- **Unknown:** whether nginx config rewrites API paths or expects same-origin. Verify: the nginx config baked into the frontend image.
