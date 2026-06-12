---
name: frontend-patterns
description: Use when designing or modifying React and TypeScript frontend components, hooks, API client usage, frontend state, routing, styling, or UI conventions.
---

# Frontend Patterns for React + TypeScript

Guidelines for the frontend SPA built with React 18, TypeScript, Tailwind CSS.

> **The design system is authoritative in [`references/ui-kit.md`](references/ui-kit.md)** — design
> tokens, the `ui/` primitive catalog (Button, Card, Dialog, Select, Table, …), CVA variants, the
> icon registry, animation utilities, and the **no-hardcoded-colors** lint rule. This file covers the
> broader app patterns (structure, hooks, API client, state, navigation); defer every component and
> styling specific to the UI Kit. Code examples below are illustrative, not authoritative.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 18 (Functional + Hooks) |
| Language | TypeScript 5.7 (strict mode) |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 4 + CSS variables |
| Charts | Lightweight Charts (TradingView) |
| UI Components | Radix UI primitives |

## Project Structure

```
frontend/src/
├── components/
│   ├── pages/          # Route-level components
│   ├── features/       # Feature-specific components
│   ├── chart/          # Chart-related components
│   ├── screener/       # Screener-related components
│   ├── layout/         # Layout components
│   ├── ui/             # Base UI primitives
│   └── icons/          # SVG icon components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and API client
├── types/              # TypeScript type definitions
└── styles/             # Global styles
```

## Key Patterns

### Component Structure

```typescript
// components/features/PriceChart.tsx
interface PriceChartProps {
  symbol: string
  data: PriceData[]
  onCrosshairMove?: (data: CrosshairData) => void
}

export function PriceChart({ symbol, data, onCrosshairMove }: PriceChartProps) {
  // Hook for chart configuration
  const { chartConfig } = useChartConfig()

  // Hook for chart controls
  const { timeframe, setTimeframe } = useChartControls()

  return (
    <div className="...">
      {/* Component implementation */}
    </div>
  )
}
```

### Custom Hooks

```typescript
// hooks/chart/useChartConfig.ts
export function useChartConfig() {
  const [config, setConfig] = useState(defaultConfig)

  const updateConfig = useCallback((newConfig: Partial<ChartConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  return { chartConfig: config, updateConfig }
}
```

### API Client (Singleton)

```typescript
// lib/api.ts
class ApiClient {
  private static instance: ApiClient
  private baseUrl: string

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
  }

  async analyze(symbol: string): Promise<AnalysisResult> {
    const response = await fetch(`${this.baseUrl}/analyze/${symbol}`)
    if (!response.ok) throw new Error('Analysis failed')
    return response.json()
  }
}

export const api = ApiClient.getInstance()
```

### Type Definitions

```typescript
// types/index.ts
export interface Stock {
  symbol: string
  name: string
  exchange: Exchange
  rsRating?: number
}

export type Exchange = 'HOSE' | 'HNX' | 'UPCOM'

export interface Filter {
  field: string
  operator: FilterOperator
  value: string | number | boolean
}

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
```

### Styling

Compose classes through `cn()` (`src/lib/utils.ts` = `twMerge(clsx(...))`). Visual variants live
in a component's `cva()` map — **never** as ad-hoc classes at the call site. Colors / spacing /
radius / motion come from **design tokens only**: `var(--token)` or the Tailwind alias
(`bg-surface`, `text-neon-cyan`). Raw hex / `rgb()` in `className` (e.g. `bg-[#00d4ff]`) is a lint
**error**. Reach for an existing `ui/` primitive before writing markup.

```tsx
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Use the kit's primitive + its CVA variants — don't hand-roll buttons.
<Button variant="primary" icon="Save">Save preset</Button>

// When composing, merge through cn() and reference tokens, not raw colors.
<div className={cn('px-4 py-2 rounded-md', isActive && 'text-neon-cyan')} />
```

> Tokens, the full primitive catalog, variants, and enforcement: [`references/ui-kit.md`](references/ui-kit.md) §2–§4, §10.

## State Management

- **Local state**: useState for component-level state
- **Persistent state**: localStorage for user preferences
- **Server state**: Fetch from API, no global state library

```typescript
// Persisting to localStorage
const [config, setConfig] = useLocalStorage('chart-config', defaultConfig)
```

## Navigation

Hash-based SPA navigation:

```typescript
// hooks/useNavigation.ts
export function useNavigation() {
  const [page, setPage] = useState(() => {
    const hash = window.location.hash.slice(1)
    return hash || 'dashboard'
  })

  const navigate = useCallback((newPage: string) => {
    window.location.hash = newPage
    setPage(newPage)
  }, [])

  return { page, navigate }
}
```

## Path Alias

Configure in `vite.config.ts`:

```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Usage:

```typescript
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
```

## Chart Integration

Lightweight Charts from TradingView:

```typescript
import { createChart, IChartApi } from 'lightweight-charts'

function usePriceChart(containerRef: RefObject<HTMLDivElement>) {
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    chartRef.current = createChart(containerRef.current, {
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#a0a0a0',
      },
      // ... more config
    })

    return () => chartRef.current?.remove()
  }, [])

  return chartRef
}
```

## Error Handling

```typescript
// lib/errors.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Usage in component
try {
  const result = await api.analyze(symbol)
} catch (error) {
  if (error instanceof ApiError) {
    toast.error(`Analysis failed: ${error.message}`)
  }
}
```

## Rules to Follow

1. **Strict TypeScript**: No `any` types, explicit return types for functions
2. **Functional components**: Use hooks, no class components
3. **Lazy loading**: Pages loaded via React.lazy
4. **CSS variables**: Use Tailwind + CSS custom properties for theming
5. **Small components**: One responsibility per component
6. **Extract hooks**: Complex logic goes into custom hooks
