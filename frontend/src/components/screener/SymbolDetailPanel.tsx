import { useMemo, useState } from 'react'
import { useSymbolAnalysis } from '../../hooks/useSymbolAnalysis'
import { PriceChart } from '../features/PriceChart'
import { CHART_INTERVAL_OPTIONS } from '../chart/intervalOptions'
import { buildRsiData } from '../../lib/rsiSeries'
import { type Stock } from '../../types'

export interface SymbolDetailPanelProps {
  stock: Stock | null
  /**
   * Bump this integer to force-remount PriceChart so it re-reads clientWidth.
   *
   * WHY: PriceChart measures container width ONCE on mount (PriceChart.tsx:96,146)
   * and only refits on window.resize (PriceChart.tsx:248-259). That resize event does
   * NOT fire when the chart pane is toggled visible or when the splitter is dragged.
   * Rather than editing the shared PriceChart component (which is also used by
   * Divergence.tsx), we force a remount by changing the React key on the wrapper.
   * Tradeoff: any internal zoom/scroll state inside PriceChart resets on each refit.
   * Resize is coarse (drag-end only), not continuous.
   */
  refitNonce?: number
  /**
   * Optional INSTANT header row. The `stock` prop feeds the (debounced) chart
   * fetch; pass the immediate active row here so symbol/exchange/price/change in
   * the header update with zero lag while the chart fetch is debounced (concern
   * C). Defaults to `stock` when omitted, so the locked `{ stock, refitNonce }`
   * contract is unchanged.
   */
  headerStock?: Stock | null
}

export function SymbolDetailPanel({
  stock,
  refitNonce = 0,
  headerStock,
}: SymbolDetailPanelProps): React.ReactElement {
  // Chart interval (timeframe). Changing it refetches the analysis at that cadence.
  // Lives here (not inside PriceChart, which unmounts during the refetch) so the
  // switch stays visible + highlighted while loading.
  const [chartInterval, setChartInterval] = useState('1D')
  // RSI on/off lives HERE (not inside PriceChart) so a user's choice survives the
  // remounts PriceChart goes through — the loading-spinner unmount on every symbol
  // switch AND the key={refitNonce} remount on splitter-drag/uncollapse: each fresh
  // PriceChart re-seeds showRsi from initialShowRsi={rsiOn}, which the parent keeps.
  // Default off.
  const [rsiOn, setRsiOn] = useState(false)

  const { result, loading, error } = useSymbolAnalysis(stock?.symbol ?? null, {
    interval: chartInterval,
    enabled: !!stock,
  })

  // Per-bar RSI for the chart (drops warm-up bars); same builder the analyze page uses.
  const rsiData = useMemo(() => (result ? buildRsiData(result.price_history) : []), [result])

  // ── Header ──────────────────────────────────────────────────────────────────
  // Header data comes directly from the passed stock row — no extra fetch.
  // It updates instantly on selection even while the chart fetch is in-flight.
  // `headerStock` (the immediate active row) is preferred so the header has zero
  // debounce lag; falls back to `stock` (the debounced chart-fetch source).
  const headerRow = headerStock !== undefined ? headerStock : stock
  const renderHeader = (): React.ReactElement | null => {
    const stock = headerRow
    if (!stock) return null

    return (
      <div
        data-testid="symbol-detail-header"
        className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-dim)]"
      >
        <div className="flex-shrink-0">
          <span className="text-base font-semibold text-[var(--text-primary)]">{stock.symbol}</span>
          <span className="ml-2 text-xs text-[var(--text-muted)]">{stock.exchange}</span>
        </div>
        {/* Full company name — fills the remaining width (the price block was
            removed); truncates with a tooltip only on very long names / narrow panes. */}
        {stock.name && stock.name !== stock.symbol && (
          <span
            data-testid="symbol-detail-name"
            title={stock.name}
            className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]"
          >
            {stock.name}
          </span>
        )}
      </div>
    )
  }

  // ── Body ─────────────────────────────────────────────────────────────────────
  const renderBody = (): React.ReactElement => {
    if (!stock) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
          <svg
            className="w-10 h-10 mb-3 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-8" />
          </svg>
          <span className="text-sm">Select a symbol</span>
        </div>
      )
    }

    if (error) {
      // Mirror Divergence.tsx:216-220 error styling. `useSymbolAnalysis` clears
      // `error` when a new symbol load starts, so this reflects the CURRENT symbol.
      return <div className="px-4 py-3 text-[var(--neon-bear)] text-[13px]">{error}</div>
    }

    // Keep PriceChart MOUNTED across symbol switches. `useSymbolAnalysis` retains the
    // previous symbol's `result` while a new fetch is in flight, so once a chart exists
    // we keep rendering it and overlay a loading spinner during refetch — instead of
    // unmounting it (the old spinner branch did, forcing a full chart.remove() +
    // createChart per symbol). lightweight-charts then swaps data via the data effect's
    // setData (init effect deps `[totalHeight, showRsi]` are unchanged by a symbol
    // switch, so the chart is NOT recreated). This is the fix for the slow first-symbol
    // render after selecting a filter.
    const hasChart = !!result && result.price_history.length > 0
    if (hasChart) {
      return (
        // key={refitNonce} forces a full remount of PriceChart when the caller bumps
        // refitNonce (on un-collapse or splitter drag-end). See SymbolDetailPanelProps
        // JSDoc above for the full rationale.
        <div key={refitNonce} className="relative h-full">
          <PriceChart
            symbol={stock.symbol}
            priceHistory={result.price_history}
            trendlines={result.trendlines}
            signals={result.signals}
            rsiData={rsiData}
            divergences={result.divergences}
            showNavZoom={false}
            fillHeight
            initialShowRsi={rsiOn}
            onShowRsiChange={setRsiOn}
            intervalControl={{
              value: chartInterval,
              options: CHART_INTERVAL_OPTIONS,
              onChange: setChartInterval,
            }}
          />
          {loading && (
            <div
              data-testid="chart-loading-overlay"
              className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-surface)]"
              aria-hidden="true"
            >
              <div className="w-6 h-6 border-2 border-[var(--border-dim)] border-t-[var(--neon-cyan)] rounded-full animate-spin" />
            </div>
          )}
        </div>
      )
    }

    // No chart yet to keep — first load shows the full-panel spinner.
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
          <div
            className="w-6 h-6 border-2 border-[var(--border-dim)] border-t-[var(--neon-cyan)] rounded-full animate-spin mb-3"
            aria-hidden="true"
          />
          <span className="text-sm">Loading chart…</span>
        </div>
      )
    }

    if (result && result.price_history.length === 0) {
      // G1: loaded but empty history — render panel's own state, do NOT mount
      // PriceChart. PriceChart's empty fallback (PriceChart.tsx:473-480) has no
      // chart-container element, which would break e2e container assertions.
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
          <svg
            className="w-10 h-10 mb-3 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-8" />
          </svg>
          <span className="text-sm">No price data available</span>
        </div>
      )
    }

    // Initial state: no result yet and not loading (e.g. stock just became non-null,
    // hook hasn't fired yet on first render tick)
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
        <span className="text-sm">Select a symbol</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)] border-l border-[var(--border-dim)]">
      {renderHeader()}
      <div className="flex-1 overflow-hidden min-h-0">{renderBody()}</div>
    </div>
  )
}

export default SymbolDetailPanel
