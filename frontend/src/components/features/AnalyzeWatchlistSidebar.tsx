import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { WatchlistQuote } from '@/hooks/useWatchlistQuotes'

interface AnalyzeWatchlistSidebarProps {
  symbols: string[]
  currentSymbol: string
  /** Company name / price / %-change per symbol (UPPER-CASE keys). */
  quotes: Map<string, WatchlistQuote>
  /** Click a row → load the symbol into the chart. */
  onSelect: (symbol: string) => void
  onRemove: (symbol: string) => void
  /** Disables row remove while a config PUT is in flight. */
  busy?: boolean
}

const fmt = (n: number, digits = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Absolute price change derived from the latest price and the % change
 *  (prevClose = price / (1 + pct/100)); guards the pct === -100 divide-by-zero. */
function absoluteChange(price: number, pct: number): number {
  const denom = 1 + pct / 100
  if (denom === 0) return 0
  return price - price / denom
}

export const AnalyzeWatchlistSidebar = memo(function AnalyzeWatchlistSidebar({
  symbols,
  currentSymbol,
  quotes,
  onSelect,
  onRemove,
  busy = false,
}: AnalyzeWatchlistSidebarProps) {
  const current = currentSymbol.trim().toUpperCase()

  if (symbols.length === 0) {
    return (
      <div className="flex flex-col gap-2" data-testid="analyze-watchlist">
        <p className="px-2 py-6 text-center text-xs text-[var(--text-muted)]">
          Your watchlist is empty. Add a symbol from the chart.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="analyze-watchlist">
      <ul className="flex flex-col gap-1">
        {symbols.map((sym) => {
          const upper = sym.toUpperCase()
          const active = upper === current
          const q = quotes.get(upper)
          const up = (q?.change ?? 0) >= 0
          const changeColor = q
            ? up
              ? 'text-[var(--neon-bull)]'
              : 'text-[var(--neon-bear)]'
            : 'text-[var(--text-muted)]'
          return (
            <li key={sym}>
              <div
                className={cn(
                  'group relative flex items-center gap-2 rounded-md border px-2.5 py-2 transition-colors',
                  active
                    ? 'bg-[var(--neon-cyan-dim)] border-[var(--neon-cyan-border)]'
                    : 'bg-transparent border-transparent hover:bg-[var(--bg-hover)]'
                )}
              >
                {/* Selected-symbol indicator: a leading accent bar on the active row. */}
                {active && (
                  <span
                    data-testid={`watchlist-active-${sym}`}
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-sm bg-[var(--neon-cyan)] shadow-[var(--neon-cyan-glow)]"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onSelect(sym)}
                  data-testid={`watchlist-item-${sym}`}
                  aria-current={active ? 'true' : undefined}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                >
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        'truncate text-[13px] font-semibold',
                        active ? 'text-[var(--neon-cyan)]' : 'text-[var(--text-primary)]'
                      )}
                    >
                      {sym}
                    </span>
                    {q?.name && (
                      <span className="truncate text-[11px] text-[var(--text-muted)]">
                        {q.name}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="font-mono text-[12px] text-[var(--text-primary)]">
                      {q ? fmt(q.price) : '—'}
                    </span>
                    {q ? (
                      <span className={cn('font-mono text-[11px]', changeColor)}>
                        {up ? '+' : ''}
                        {fmt(absoluteChange(q.price, q.change))} ({up ? '+' : ''}
                        {q.change.toFixed(2)}%)
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">—</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(sym)}
                  disabled={busy}
                  data-testid={`watchlist-remove-${sym}`}
                  aria-label={`Remove ${sym} from watchlist`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 grid place-items-center w-6 h-6 shrink-0 rounded text-[var(--text-muted)] hover:text-[var(--neon-bear)] disabled:opacity-30 transition-all"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
})
