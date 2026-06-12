import { useState, useMemo, useEffect, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Icons } from '../icons/Icons'
import { CHART_INTERVAL_OPTIONS } from '../chart/intervalOptions'
import { SignalsTable } from './SignalsTable'
import { SymbolSearchInput } from './SymbolSearchInput'
import { PriceChart } from './PriceChart'
import { cn } from '@/lib/utils'
import {
  isSignalConfirmed,
  isSignalPotential,
  type ApiAnalysisResult,
  type ApiDivergence,
} from '@/lib/api'
import { buildRsiData } from '@/lib/rsiSeries'

// 'potential' replaces the legacy 'watching' label (matches the backend *_potential SignalType).
export type SignalType = 'all' | 'breakout' | 'breakdown' | 'confirmed' | 'potential'

const SIGNAL_TYPE_OPTIONS: { value: SignalType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'breakout', label: 'Breakout' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'potential', label: 'Potential' },
]

// Static literal classes per chip — NOT dynamically constructed, so Tailwind's JIT
// always generates them, and every token (cyan/bull/bear/amber) is defined in global.css.
// (Fixes the prior bug: breakdown->'rose' / breakout->'emerald' + inactive --card-bg were undefined.)
const CHIP_ACTIVE: Record<SignalType, string> = {
  all: 'bg-[var(--neon-cyan)] text-black border-transparent',
  breakout: 'bg-[var(--neon-bull)] text-black border-transparent',
  breakdown: 'bg-[var(--neon-bear)] text-black border-transparent',
  confirmed: 'bg-[var(--neon-cyan)] text-black border-transparent',
  potential: 'bg-[var(--neon-amber)] text-black border-transparent',
}
const CHIP_INACTIVE =
  'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-[var(--border-dim)]'

interface AnalyzePageProps {
  symbol: string
  timeframe: string
  analysisResult: ApiAnalysisResult | null
  loading: boolean
  error: string | null
  onTimeframeChange: (value: string) => void
  /** Load a symbol typed/picked in the on-chart symbol search box. */
  onSubmitSymbol: (value: string) => void
  /** Symbol universe for the search autocomplete (from the cached stock list). */
  symbolOptions: string[]
  /** Whether the current symbol is already in the watchlist (drives the add/remove control). */
  inWatchlist: boolean
  /** Add the current symbol to the watchlist (or remove it when already present). */
  onToggleWatchlist: () => void
  /** Disables the on-chart add control while a config PUT is in flight. */
  watchlistBusy?: boolean
  /** Watchlist sidebar content (filled by the shell; placeholder otherwise). */
  sidebar?: ReactNode
}

export function AnalyzePage({
  symbol,
  timeframe,
  analysisResult,
  loading,
  error,
  onTimeframeChange,
  onSubmitSymbol,
  symbolOptions,
  inWatchlist,
  onToggleWatchlist,
  watchlistBusy = false,
  sidebar,
}: AnalyzePageProps) {
  // Draft for the on-chart symbol box; re-syncs whenever the active symbol changes
  // (watchlist click, deep-link) so the box always reflects what's loaded.
  const [symbolDraft, setSymbolDraft] = useState(symbol)
  useEffect(() => {
    setSymbolDraft(symbol)
  }, [symbol])
  const [signalType, setSignalType] = useState<SignalType>('all')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [stripOpen, setStripOpen] = useState(true)
  // Bumped on sidebar collapse so PriceChart force-remounts and re-measures width
  // (PriceChart measures container width once on mount; screener uses the same pattern).
  const [refitNonce, setRefitNonce] = useState(0)

  const toggleSidebar = () => {
    setSidebarCollapsed((c) => !c)
    setRefitNonce((n) => n + 1)
  }

  const signals = analysisResult?.signals
  // Bucket the signals once; both the chip counts and the active filtered list are
  // derived from these buckets (avoids re-scanning the list per chip + per filter).
  const { categorized, counts } = useMemo(() => {
    const all = signals ?? []
    const breakout = all.filter((s) => s.type.includes('breakout'))
    const breakdown = all.filter((s) => s.type.includes('breakdown'))
    const confirmed = all.filter((s) => isSignalConfirmed(s))
    const potential = all.filter((s) => isSignalPotential(s))
    return {
      categorized: { all, breakout, breakdown, confirmed, potential },
      counts: {
        all: all.length,
        breakout: breakout.length,
        breakdown: breakdown.length,
        confirmed: confirmed.length,
        potential: potential.length,
      } as Record<SignalType, number>,
    }
  }, [signals])

  const filteredSignals = categorized[signalType]

  const bullishDivergences = useMemo(
    () => analysisResult?.divergences?.filter((d: ApiDivergence) => d.type === 'bullish') || [],
    [analysisResult?.divergences]
  )
  const bearishDivergences = useMemo(
    () => analysisResult?.divergences?.filter((d: ApiDivergence) => d.type === 'bearish') || [],
    [analysisResult?.divergences]
  )

  const trendlines = useMemo(() => analysisResult?.trendlines || [], [analysisResult?.trendlines])
  const rsiData = useMemo(
    () => (analysisResult?.price_history ? buildRsiData(analysisResult.price_history) : []),
    [analysisResult?.price_history]
  )

  const hasChart = !!analysisResult && analysisResult.price_history.length > 0

  return (
    <div className="animate-slide-in-from-bottom">
      <div
        className={cn(
          'grid grid-cols-1 gap-4 items-start',
          sidebarCollapsed ? 'lg:grid-cols-[1fr_56px]' : 'lg:grid-cols-[1fr_256px]'
        )}
      >
        {/* ===== Watchlist sidebar (right column via order-last) ===== */}
        <aside
          className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] overflow-hidden order-last"
          data-testid="analyze-sidebar"
        >
          <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-dim)]">
            {!sidebarCollapsed && (
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <Icons.Bell className="w-4 h-4 text-[var(--neon-cyan)]" />
                Watchlist
              </span>
            )}
            <button
              type="button"
              onClick={toggleSidebar}
              data-testid="analyze-sidebar-toggle"
              aria-label={sidebarCollapsed ? 'Expand watchlist' : 'Collapse watchlist'}
              className="grid place-items-center w-7 h-7 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-dim)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={sidebarCollapsed ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
                />
              </svg>
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="p-2">
              {sidebar ?? (
                <p className="px-2 py-6 text-center text-xs text-[var(--text-muted)]">
                  Your watchlist symbols appear here.
                </p>
              )}
            </div>
          )}
        </aside>

        {/* ===== Main column ===== */}
        <section className="min-w-0">
          {/* Hero chart — symbol + timeframe controls live on the chart toolbar */}
          <Card>
            <Card.Header
              action={
                <div className="flex gap-2 items-center">
                  <Badge variant="bull">{String(bullishDivergences.length)} Bullish</Badge>
                  <Badge variant="bear">{String(bearishDivergences.length)} Bearish</Badge>
                  {analysisResult && (
                    <Badge variant="cyan">
                      {SIGNAL_TYPE_OPTIONS.find((o) => o.value === signalType)?.label || 'All'}:{' '}
                      {filteredSignals.length}
                    </Badge>
                  )}
                </div>
              }
            >
              <Icons.Chart />
              <SymbolSearchInput
                value={symbolDraft}
                onChange={setSymbolDraft}
                onSubmit={onSubmitSymbol}
                options={symbolOptions}
                data-testid="analyze-chart-symbol-input"
              />
              <button
                type="button"
                onClick={onToggleWatchlist}
                disabled={watchlistBusy || !symbol.trim()}
                data-testid="analyze-chart-add"
                aria-pressed={inWatchlist}
                title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40',
                  inWatchlist
                    ? 'border-[var(--neon-cyan-border)] bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]'
                    : 'border-[var(--border-dim)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                {inWatchlist ? '✓ In watchlist' : '+ Add to watchlist'}
              </button>
              {loading && (
                <span
                  className="ml-1 text-xs font-normal text-[var(--text-muted)]"
                  data-testid="analyze-loading"
                >
                  Analyzing…
                </span>
              )}
            </Card.Header>
            <Card.Body>
              {error && (
                <div
                  className="mb-3 text-[13px] text-[var(--neon-bear)]"
                  data-testid="analyze-error"
                >
                  {error}
                </div>
              )}
              {hasChart ? (
                <PriceChart
                  key={refitNonce}
                  symbol={symbol || 'FPT'}
                  priceHistory={analysisResult!.price_history}
                  trendlines={trendlines}
                  signals={filteredSignals}
                  rsiData={rsiData}
                  divergences={analysisResult!.divergences}
                  showNavZoom={false}
                  initialShowRsi
                  initialHeight={560}
                  intervalControl={{
                    value: timeframe,
                    options: CHART_INTERVAL_OPTIONS,
                    onChange: onTimeframeChange,
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-[var(--text-muted)]">
                  <Icons.Chart className="w-12 h-12 mb-3" />
                  <span className="text-sm">
                    {analysisResult
                      ? 'No price data available'
                      : 'Type a symbol above (or pick one from the watchlist) to load the chart'}
                  </span>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Signal strip (collapsible) */}
          <Card className="mt-4">
            <Card.Body>
              <button
                type="button"
                onClick={() => setStripOpen((o) => !o)}
                className="flex w-full items-center justify-between"
                data-testid="analyze-signal-strip-toggle"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <Icons.Chart className="w-4 h-4 text-[var(--neon-cyan)]" />
                  Signals
                </span>
                <span className="flex items-center gap-3">
                  <span className="hidden sm:flex items-center gap-2 text-[11px]">
                    <Badge variant="cyan">✓ {counts.confirmed} confirmed</Badge>
                    <Badge variant="amber">P {counts.potential} potential</Badge>
                  </span>
                  <svg
                    className={cn(
                      'w-4 h-4 text-[var(--text-muted)] transition-transform',
                      !stripOpen && '-rotate-90'
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 9l6 6 6-6"
                    />
                  </svg>
                </span>
              </button>

              {stripOpen && (
                <div className="mt-4">
                  {/* Signal-type filter chips (fixed tokens + live counts) */}
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <span className="text-sm text-[var(--text-muted)]">Signal type:</span>
                    <div className="flex gap-2 flex-wrap">
                      {SIGNAL_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSignalType(option.value)}
                          data-testid={`signal-chip-${option.value}`}
                          aria-pressed={signalType === option.value}
                          className={cn(
                            'px-3 py-1.5 rounded-md text-xs font-medium border transition-all inline-flex items-center gap-1.5',
                            signalType === option.value ? CHIP_ACTIVE[option.value] : CHIP_INACTIVE
                          )}
                        >
                          {option.label}
                          <span className="text-[10px] font-bold opacity-70">
                            {counts[option.value]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Trendline signals list — the real analyze signals, chip-filtered.
                      Divergence is shown directly on the RSI sub-pane, so there are no
                      separate bullish/bearish cards here. */}
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    Trendline signals on chart
                    <span className="ml-1 normal-case tracking-normal">
                      · {filteredSignals.length}
                    </span>
                  </div>
                  <SignalsTable signals={filteredSignals} />
                </div>
              )}
            </Card.Body>
          </Card>
        </section>
      </div>
    </div>
  )
}
