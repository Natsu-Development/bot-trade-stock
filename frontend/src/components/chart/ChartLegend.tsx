import { memo } from 'react'
import type { ApiTrendlineDisplay, ApiTradingSignal } from '@/lib/api'

export interface ChartLegendProps {
  trendlines: ApiTrendlineDisplay[]
  signals: ApiTradingSignal[]
  showTrendlines: boolean
  showSignals: boolean
  showRsi: boolean
  rsiData: Array<{ time: string; value: number }>
  priceHistoryLength: number
  symbol: string
}

export const ChartLegend = memo(function ChartLegend({
  trendlines,
  signals,
  showTrendlines,
  showSignals,
  showRsi,
  rsiData,
  priceHistoryLength,
  symbol,
}: ChartLegendProps) {
  const supportCount = trendlines.filter(t => t.type === 'uptrend_support').length
  const resistanceCount = trendlines.filter(t => t.type === 'downtrend_resistance').length
  const confirmedSignals = signals.filter(s => s.signal_level === 'confirmed').length
  const watchingSignals = signals.filter(s => s.signal_level !== 'confirmed').length
  const latestRsi = rsiData.length > 0 ? rsiData[rsiData.length - 1]?.value : null

  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <div className="flex flex-wrap gap-3 text-xs">
        {trendlines.length > 0 && showTrendlines && (
          <>
            {supportCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-[var(--neon-bull)] rounded" style={{ background: 'repeating-linear-gradient(90deg, #10b981, #10b981 3px, transparent 3px, transparent 6px)' }} />
                <span className="text-[var(--text-muted)]">
                  Support ({supportCount})
                </span>
              </div>
            )}
            {resistanceCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-[var(--neon-bear)] rounded" style={{ background: 'repeating-linear-gradient(90deg, #ef4444, #ef4444 3px, transparent 3px, transparent 6px)' }} />
                <span className="text-[var(--text-muted)]">
                  Resistance ({resistanceCount})
                </span>
              </div>
            )}
          </>
        )}
        {signals.length > 0 && showSignals && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-[var(--border-primary)]/20">
            <svg className="w-3 h-3 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <span className="text-[var(--text-muted)]">
              {confirmedSignals} Confirmed
            </span>
            {watchingSignals > 0 && (
              <span className="text-[var(--text-muted)]">
                · {watchingSignals} Watching
              </span>
            )}
          </div>
        )}
        {priceHistoryLength > 0 && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-[var(--border-primary)]/20">
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-3 rounded-sm" style={{ background: 'linear-gradient(to top, rgba(16, 185, 129, 0.5) 50%, rgba(239, 68, 68, 0.5) 50%)' }} />
            </div>
            <span className="text-[var(--text-muted)]">Volume</span>
          </div>
        )}
        {showRsi && rsiData.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-[var(--border-primary)]/20">
            <svg className="w-3 h-3 text-[var(--neon-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <span className="text-[var(--text-muted)]">RSI ({latestRsi?.toFixed(1) || 'N/A'})</span>
          </div>
        )}
      </div>

      {/* Timeframe Info */}
      <div className="text-[var(--text-muted)] text-xs">
        {priceHistoryLength} bars · {symbol}
      </div>
    </div>
  )
})
