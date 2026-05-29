---
paths:
  - "frontend/**/*.{ts,tsx}"
---

# Frontend Rules (React + TypeScript)

## TypeScript Configuration

- **Strict mode** enabled with no unused locals/params
- **Path alias**: `@/` maps to `./src/`

## Component Conventions

- **Components**: Functional with hooks, lazy-loaded pages
- **State**: React hooks + localStorage for persistence
- **API**: Singleton `ApiClient` class in `lib/api.ts`
- **Styling**: Tailwind CSS with CSS custom properties (neon-cyan theme)

## Directory Structure

```
frontend/src/
├── components/
│   ├── pages/       # Page components (Dashboard, Screener, Divergence, Config)
│   ├── features/    # Feature components (PriceChart, SearchBox, SignalCard)
│   ├── chart/       # Chart sub-components (Controls, Legend, Crosshair)
│   ├── screener/    # Screener sub-components (FilterBar, FilterEditor)
│   ├── layout/      # Layout (Sidebar, Header)
│   └── ui/          # Base UI (Button, Card, Badge, Dialog, Table)
├── hooks/           # Custom hooks by feature (chart/, screener/)
├── lib/             # Utilities (api.ts, utils.ts, screenerUtils.ts)
├── types/           # TypeScript type definitions
└── styles/          # Global CSS + Tailwind
```
