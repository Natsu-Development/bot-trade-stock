# VN Trading Terminal — UI Kit

> **Authoritative reference** for the frontend design system. Read this before building or modifying any UI. The goal is a single, on-theme, "neon trading terminal" look produced consistently — by humans and AI agents alike.
>
> **Source of truth:** design tokens live in `src/styles/global.css` (`:root`) and are surfaced to Tailwind in `tailwind.config.js`. Components reference tokens via `var(--token)` — **never hardcode a hex/rgb color** (this is lint-enforced; see [§10](#10-enforcement)).

---

## 1. Philosophy & stack

A hand-rolled, shadcn-style kit (no monolithic component library): **Radix UI primitives** for behavior/a11y, **`class-variance-authority` (CVA)** for variants, **CSS variables** for theming, and **`cn()`** to merge classes.

| Category            | Tech                                             |
| ------------------- | ------------------------------------------------ |
| Framework           | React 18 (functional + hooks)                    |
| Language            | TypeScript 5.7 (strict)                          |
| Build               | Vite 6                                           |
| Styling             | Tailwind CSS **v4** + CSS custom properties      |
| Headless primitives | Radix UI (`dialog`, `switch`, `tooltip`, `slot`) |
| Variants            | `class-variance-authority`                       |
| Charts              | Lightweight Charts (TradingView)                 |

**Aesthetic:** void-black backgrounds, neon bull/bear/cyan accents, glow shadows, monospace numerics, an animated grid + floating-orb backdrop.

---

## 2. Design tokens

Defined in `src/styles/global.css` → aliased in `tailwind.config.js`. Use the **Tailwind alias** in JSX (`bg-surface`) or the **arbitrary-value form referencing the var** (`bg-[var(--bg-surface)]`) — both resolve to the same token. Do not inline raw colors.

### Backgrounds (5-step elevation ladder)

| Token           | Tailwind alias           | Value     |
| --------------- | ------------------------ | --------- |
| `--bg-void`     | `bg-void` / `background` | `#06060a` |
| `--bg-deep`     | `bg-deep`                | `#0a0a0f` |
| `--bg-surface`  | `surface`                | `#101016` |
| `--bg-elevated` | `elevated`               | `#16161e` |
| `--bg-hover`    | `hover`                  | `#1c1c26` |

### Borders & text

| Token              | Alias            | Value     |
| ------------------ | ---------------- | --------- |
| `--border-dim`     | `border-dim`     | `#1e1e28` |
| `--border-glow`    | `border-glow`    | `#2a2a36` |
| `--text-primary`   | `text-primary`   | `#f4f4f5` |
| `--text-secondary` | `text-secondary` | `#a1a1aa` |
| `--text-muted`     | `text-muted`     | `#71717a` |

### Neon palette (semantic)

| Token           | Alias         | Value     | Meaning                       |
| --------------- | ------------- | --------- | ----------------------------- |
| `--neon-bull`   | `neon-bull`   | `#00ff88` | up / positive / success       |
| `--neon-bear`   | `neon-bear`   | `#ff3366` | down / negative / error       |
| `--neon-cyan`   | `neon-cyan`   | `#00d4ff` | primary accent / focus / info |
| `--neon-amber`  | `neon-amber`  | `#ffaa00` | warning / UPCOM               |
| `--neon-purple` | `neon-purple` | `#9966ff` | HNX / category accent         |

Each neon also has a `*-dim` (low-alpha fill for badges/chips) and a `*-glow` (`box-shadow`) variant: `neon-bull`, `neon-bear`, `neon-cyan` shadows are exposed as `shadow-neon-bull` etc.

**Extended neon tokens** (added so no component hardcodes a color):

| Token                                                                                      | Value                             | Use                                   |
| ------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------- |
| `--neon-bull-deep` / `--neon-bear-deep` / `--neon-cyan-deep`                               | `#00cc6a` / `#cc2952` / `#00a8cc` | gradient end-stops (button gradients) |
| `--neon-purple-dim` / `--neon-amber-dim`                                                   | `rgba(…, 0.13)`                   | badge/chip dim fills (HNX / UPCOM)    |
| `--neon-amber-soft`                                                                        | `rgba(255,170,0,0.06)`            | soft amber surface (paused warning)   |
| `--neon-bull-border` / `--neon-bear-border` / `--neon-amber-border` / `--neon-cyan-border` | `rgba(…, 0.25–0.3)`               | translucent status borders            |
| `--overlay-void`                                                                           | `rgba(6,6,10,0.85)`               | modal backdrop scrim                  |

### Radius, type, motion

| Token                   | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| `--radius-sm / md / lg` | `4px / 8px / 12px` (Tailwind `rounded-sm/md/lg`)            |
| `--font-display`        | `Outfit, sans-serif` (UI text) → `font-display`             |
| `--font-mono`           | `JetBrains Mono, monospace` (**all numbers**) → `font-mono` |
| `--transition-fast`     | `150ms cubic-bezier(.4,0,.2,1)`                             |
| `--transition-smooth`   | `300ms cubic-bezier(.4,0,.2,1)`                             |

**Rule of thumb:** every number (price, %, RS rating, counts) renders in `font-mono`. UI labels/headings use `font-display`.

---

## 3. Core conventions

### `cn()` — always use it

`src/lib/utils.ts` exports `cn(...inputs)` = `twMerge(clsx(inputs))`. `clsx` resolves conditionals; `twMerge` dedupes conflicting Tailwind classes so a caller's `className` cleanly overrides defaults. **Every component composes classes through `cn()`.**

```tsx
import { cn } from '@/lib/utils'
;<div className={cn('px-4 py-2', isActive && 'text-neon-cyan', className)} />
```

Shared semantic helpers also live in `utils.ts`: `getRsLevel(value)`, `getBadgeVariantFromExchange(exchange)`, `formatPrice(price)`.

### CVA — variants belong in one place

New visual states (a button style, a badge color) are added to the component's `cva()` map, **not** as ad-hoc classes at the call site. This keeps every instance in sync.

---

## 4. Base primitives (`src/components/ui/`)

Import from `@/components/ui/<file>`.

### Button — `button.tsx`

CVA + Radix `Slot`. Typed `icon` prop renders an icon from the registry.

- **variant** (default `secondary`): `primary` (bull gradient), `secondary` (elevated + border), `ghost` (transparent), `bear` (bear gradient), `cyan` (cyan gradient)
- **size** (default `default`): `default` (h-10), `sm` (h-8, text-xs), `lg` (h-12), `icon` (square h-10 w-10)
- **`asChild`** to render as a child element (e.g. an `<a>`), **`icon`**: `IconName`

```tsx
<Button variant="primary" icon="Save">Save preset</Button>
<Button variant="ghost" size="icon" icon="Settings" aria-label="Settings" />
```

### Badge — `badge.tsx`

`memo`'d CVA pill. **variant** (default `default`): `hose`, `hnx`, `upcom` (exchange colors), `bull`, `bear`, `cyan`, `amber`, `purple`, `default`, `outline`. Pair with `getBadgeVariantFromExchange()`.

### Card — `card.tsx`

Compound, namespaced API. `Card` is the bordered surface (hover raises the border). Subparts:

- **`Card.Header`** — title row; auto-colors nested `svg` cyan + sizes to 18px; optional `action` slot (right side)
- **`Card.Body`** — `px-5 py-5` · **`Card.Content`** — `p-5`

```tsx
<Card>
  <Card.Header action={<Button size="sm">Edit</Button>}>
    <Icons.Bell />
    Alerts
  </Card.Header>
  <Card.Body>…</Card.Body>
</Card>
```

### Dialog — `dialog.tsx`

Radix Dialog with theme styling (blurred overlay, slide-in). Parts: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogBody`, `DialogFooter`, `DialogClose`, **`DialogIcon`** (cyan rounded icon chip).

- **`DialogContent` props:** `size` = `sm`(400) / `md`(500, default) / `lg`(600) / `xl`(800) px; `overlayClassName` (e.g. `backdrop-blur-none` to skip full-page blur cost on heavy screens).

### Input — `input.tsx`

forwardRef text input. Props: `label` (uppercase tracked label, auto `useId`), `startIcon`, `endIcon`, `inputContainerClassName`. Mono font, cyan focus ring.

### NumberInput — `NumberInput.tsx`

Controlled numeric input that commits **on blur or after `debounceMs` (300)** to avoid re-render per keystroke. Props: `value: number`, `onChange: (n: number) => void`, `debounceMs?`. Uses `type=text` + `inputMode=decimal` (no spinners, mobile decimal keyboard). Pass theme classes via `className` (it is unstyled by default — typically `className="form-input"`).

### Table — `table.tsx`

forwardRef set, auto-wrapped in `overflow-x-auto`: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow` (**`selected` prop** → `data-state=selected` highlight), `TableHead` (uppercase 11px muted), `TableCell` (mono), `TableCaption`. Rows get a staggered fade-in (see [§7](#7-global-utility-classes)).

### Switch — `switch.tsx`

Radix switch; track turns **bull-green** when checked. Drop-in for boolean settings.

### Tooltip — `tooltip.tsx`

Radix tooltip: wrap the app in `TooltipProvider`, then `Tooltip` / `TooltipTrigger` / `TooltipContent` (`sideOffset` default 4). ⚠️ see [§9](#9-known-gaps--inconsistencies) — `TooltipContent` references an undefined token.

### StatCard — `StatCard.tsx`

`memo`'d metric tile. Props: `label`, `value`, `change?`, `variant` = `bullish` / `bearish` / `default`, `icon?`. The `change` chip auto-colors: `+`/`↑` → bull, `-`/`↓` → bear, else cyan. Hover reveals a top gradient sweep keyed to `variant`.

### Toast — `Toast.tsx`

Imperative API (no provider needed) — renders into a self-managed top-right container:

```tsx
import { toast } from '@/components/ui/Toast'
toast.success('Preset saved')
toast.error('Request failed', 5000) // optional duration ms
toast({ message: 'Heads up', type: 'warning', position: 'bottom-center' })
```

Types: `success` (bull), `error` (bear), `warning` (amber), `info` (cyan) — colored left border + icon. Auto-dismiss default 3000ms (`0` = sticky).

### Select — `select.tsx`

Themed Radix Select — the accessible, consistent replacement for native `<select className="form-select">` and ad-hoc dropdowns. Parts: `Select` (Root; `value` / `onValueChange`), `SelectTrigger`, `SelectValue` (`placeholder`), `SelectContent`, `SelectItem` (`value`), `SelectGroup`, `SelectLabel`, `SelectSeparator`, and scroll buttons.

```tsx
<Select value={tf} onValueChange={setTf}>
  <SelectTrigger>
    <SelectValue placeholder="Timeframe" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1D">Daily (1D)</SelectItem>
  </SelectContent>
</Select>
```

### Checkbox — `checkbox.tsx`

Radix checkbox, **cyan when checked** — replaces raw `<input type="checkbox">` / `.form-checkbox`. Standard Radix props (`checked`, `onCheckedChange`, `disabled`).

### Skeleton — `skeleton.tsx`

Loading placeholder (pulse on `--bg-elevated`). Compose several to mock a row/card while data loads:

```tsx
<Skeleton className="h-4 w-32" />
```

### EmptyState — `empty-state.tsx`

Standard "nothing here" panel for empty tables / no results. Props: `icon?` (IconName, default `Search`), `title`, `description?`, `action?` (CTA node).

```tsx
<EmptyState
  icon="Search"
  title="No matches"
  description="Adjust your filters."
  action={<Button>Reset</Button>}
/>
```

---

## 5. Icon system (`src/components/icons/Icons.tsx`)

A single typed registry of **35 inline SVGs** exported as `Icons`, with `type IconName = keyof typeof Icons`. All icons use `viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth="2"` — so they inherit **color from text** and **size from the `icon-*` utility classes**.

Available names: `Dashboard, Search, Chart, Settings, Sliders, Refresh, Save, Filter, Clock, Users, TrendUp, TrendDown, Database, BarChart, Grid, Mail, Moon, GridSmall, Zap, Sun, Bell, CheckCircle, XCircle, Alert, Info, Plus, RotateCcw, Undo, List, Trash2, Settings2, Send, ChevronRight, ChevronDown, Check`.

```tsx
import { Icons } from '@/components/icons/Icons'
;<span className="icon-md text-neon-cyan">
  <Icons.Bell />
</span>
// or via Button: <Button icon="Refresh">Refresh</Button>
```

**Adding an icon:** add one entry to the `Icons` object (same SVG attributes) — `IconName` updates automatically and it's instantly usable in `<Button icon=…>`.

---

## 6. Animation library

Keyframes + named utilities are defined in both `global.css` (`@theme`) and `tailwind.config.js`. Use as `animate-<name>`:

`fade-in`, `fade-out`, `slide-in-from-top`, `slide-in-from-bottom`, `slide-in-from-right`, `slide-out-to-right`, `slide-out-to-top`, `row-fade-in`, `orb-float`, `status-blink`, `logo-pulse`, `chart-scan`, `stat-card-in`, `spin`.

Dialogs and toasts already wire these to Radix `data-[state]` transitions.

---

## 7. Global utility classes

Custom classes in `global.css` (`@layer components` / `@layer utilities`) that extend Tailwind. Prefer these over re-inventing layout:

- **Forms:** `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-checkbox` (raw CSS form styling; `.form-input` is the canonical text-field look — pair with `<NumberInput className="form-input">`)
- **Grids:** `.config-grid` (3-col, responsive), `.config-grid-2`, `.grid-2`, `.grid-3`
- **Sections:** `.config-section`, `.config-section-title` (icon + underline)
- **Icon sizing:** `.icon-sm/.icon-md/.icon-lg/.icon-xl/.icon-2xl` (14→24px) and `.icon-text` wrappers (icon + label spacing)
- **Status:** `.connection-status.connected/.disconnected` (blinking dot)
- **Misc:** `.symbol-tags`, `.settings-list`, `.logo`, `.alert-row-grid` (fixed-column grid shared by the Stock Alerts header + rows)
- **Table rows** automatically get a staggered `rowFadeIn` (first 8 rows).

---

## 8. Composite & domain components

Built **from** the primitives above — reuse these instead of rebuilding:

- **`features/`** — `PriceChart`, `RSRating`, `SearchBox`, `SignalCard`, `SymbolTag`, `FilterPresetCard`, `MetricsFilterSection`, `SettingsItem`, and the Stock-Alerts family (`StockAlertRow`, `StockAlertEditorModal`, `StockAlertStatusBadge`, `StockAlertCategoryChips`, `StockAlertConditionDetail`, `StockAlertsSection`)
- **`chart/`** — `ChartControls`, `ChartLegend`, `CrosshairOverlay`, `ChartShortcutsHint`
- **`screener/`** — `FilterBar`, `FilterEditor`, `FilterPill`, `QuickPresets`, `ColumnSelector`, `SaveFilterPresetDialog`, `ScreenerResultsTable`, `SymbolDetailPanel`
- **`layout/`** — `Sidebar` (72px rail), `Header`
- **`pages/`** — `Dashboard`, `Screener`, `Divergence`, `Config` (lazy-loaded)

Domain styling helpers: `lib/alertStyles.ts`, `lib/alertOptions.ts`, `lib/screenerFilterOptions.ts`.

---

## 9. Known gaps & inconsistencies

Honest list so contributors (human or AI) don't trip on them or paper over them:

**Resolved in the kit-hardening pass:** `Select`, `Checkbox`, `Skeleton`, `EmptyState` now exist ([§4](#4-base-primitives-srccomponentsui)); the `TooltipContent` `--border-subtle` bug is fixed (now `--border-glow`); and every hardcoded theme color was migrated to a token, so the no-color rule is enforced as an **error** ([§10](#10-enforcement)).

**Still missing** — add to `ui/` (Radix-based where possible) when needed: `Radio`, `Tabs`, `Popover`, `Accordion`, standalone `Label`, `Separator`, `Textarea`, `Spinner` (a `spin` animation exists but no component), `Pagination`.

**Dropdowns — partially converged:**

- ✅ `pages/Divergence.tsx` now uses the `Select` primitive.
- ⏳ Still on native `<select>` / custom dropdowns — left untouched because they're part of the in-progress filter revamp; migrate to `Select` when next touched: `screener/FilterGroup.tsx`, `screener/FilterEditor.tsx`, `pages/Settings.tsx` (an uncontrolled placeholder), and the hover-based `screener/ColumnSelector.tsx`.

**Checkbox:** the `Checkbox` primitive exists; `ColumnSelector.tsx` and `.form-checkbox` still use raw inputs — migrate when touched.

**No visual reference / regression net:** there is no Storybook/gallery route and the Playwright e2e suite has no screenshot assertions. Consider adding both.

---

## 10. Enforcement

Consistency is now mechanically guarded (see `eslint.config.js`, `.prettierrc.json`):

- **No hardcoded colors (error):** a `no-restricted-syntax` rule flags Tailwind arbitrary values containing raw `#hex` / `rgb()` / `rgba()` / `hsl()` in `className` — e.g. `bg-[#123456]`. It **allows** `[var(--token)]`. **Exemption:** pure black/white (`rgba(0,0,0,…)`, `rgba(255,255,255,…)`) is permitted — those are shadow/scrim colors, not brand tokens. Enforced as an **error**; the tree is currently clean.
- **Formatting:** Prettier via `.prettierrc.json`.

Scripts (`package.json`):

```bash
yarn lint          # eslint .
yarn lint:fix      # eslint . --fix
yarn format        # prettier --write .   (apply formatting)
yarn format:check  # prettier --check .   (CI-safe, no writes)
yarn typecheck     # tsc --noEmit
```

### Checklist for a new component

1. Put base primitives in `ui/`; compose features elsewhere.
2. Colors/spacing/radius/motion → **tokens only** (`var(--…)` or Tailwind alias). No raw hex.
3. Variants → a `cva()` map; merge `className` through `cn()`.
4. Numbers → `font-mono`; labels → uppercase tracked.
5. Interactive/overlay behavior → reach for a Radix primitive first (a11y for free).
6. Icons → add to `Icons` registry, never inline ad-hoc SVGs.
7. `yarn lint && yarn typecheck` clean before committing.
