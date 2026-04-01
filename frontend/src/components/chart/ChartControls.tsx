import { memo } from 'react'
import { cn } from '@/lib/utils'

export interface ChartControlsProps {
  zoomPercentage: number
  canZoomIn: boolean
  canZoomOut: boolean
  showTrendlines: boolean
  showSignals: boolean
  showRsi: boolean
  hasRsiData: boolean
  chartHeight: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onGoToStart: () => void
  onGoToEnd: () => void
  onScrollLeft: () => void
  onScrollRight: () => void
  onToggleTrendlines: () => void
  onToggleSignals: () => void
  onToggleRsi: () => void
  onToggleChartHeight: () => void
}

export const ChartControls = memo(function ChartControls({
  zoomPercentage,
  canZoomIn,
  canZoomOut,
  showTrendlines,
  showSignals,
  showRsi,
  hasRsiData,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onGoToStart,
  onGoToEnd,
  onScrollLeft,
  onScrollRight,
  onToggleTrendlines,
  onToggleSignals,
  onToggleRsi,
  onToggleChartHeight,
}: ChartControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Navigation Controls */}
      <div className="flex items-center bg-[var(--bg-secondary)] rounded-md p-0.5">
        <button
          onClick={onGoToStart}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
          title="Go to start (Home)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onScrollLeft}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
          title="Scroll left (←)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onResetZoom}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all"
          title="Reset zoom (R)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          onClick={onScrollRight}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
          title="Scroll right (→)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={onGoToEnd}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
          title="Go to end (End)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center bg-[var(--bg-secondary)] rounded-md p-0.5">
        <button
          onClick={onZoomOut}
          disabled={!canZoomOut}
          className={cn(
            'p-1.5 rounded transition-all',
            canZoomOut
              ? 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              : 'text-[var(--text-muted)]/30 cursor-not-allowed'
          )}
          title="Zoom out (-)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <div className="px-2 text-xs text-[var(--text-muted)] font-mono min-w-[3rem] text-center">
          {zoomPercentage}%
        </div>
        <button
          onClick={onZoomIn}
          disabled={!canZoomIn}
          className={cn(
            'p-1.5 rounded transition-all',
            canZoomIn
              ? 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              : 'text-[var(--text-muted)]/30 cursor-not-allowed'
          )}
          title="Zoom in (+)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="w-px h-6 bg-[var(--border-primary)]/30 mx-1" />

      {/* Overlay Toggles */}
      <button
        onClick={onToggleTrendlines}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          showTrendlines
            ? 'bg-[var(--neon-bull)]/20 text-[var(--neon-bull)] border border-[var(--neon-bull)]/30'
            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        )}
        title="Toggle trendlines"
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Trendlines
        </span>
      </button>
      <button
        onClick={onToggleSignals}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          showSignals
            ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30'
            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        )}
        title="Toggle signals"
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Signals
        </span>
      </button>
      {hasRsiData && (
        <button
          onClick={onToggleRsi}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            showRsi
              ? 'bg-[var(--neon-purple)]/20 text-[var(--neon-purple)] border border-[var(--neon-purple)]/30'
              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
          title="Toggle RSI"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            RSI
          </span>
        </button>
      )}
      <button
        onClick={onToggleChartHeight}
        className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
        title="Toggle chart size"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  )
})
