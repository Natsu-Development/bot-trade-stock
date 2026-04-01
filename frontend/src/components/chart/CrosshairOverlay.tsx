import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'

export interface CrosshairInfo {
  time?: string
  price?: number
  OHLC?: {
    open: number
    high: number
    low: number
    close: number
  }
}

export interface CrosshairOverlayRef {
  update: (info: CrosshairInfo) => void
}

export interface CrosshairOverlayProps {
  crosshairInfo?: CrosshairInfo // Optional for backward compatibility
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatPrice = (value: number): string => {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const CrosshairOverlay = forwardRef<CrosshairOverlayRef, CrosshairOverlayProps>(
  function CrosshairOverlay(_props, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const dateRef = useRef<HTMLSpanElement>(null)
    const openRef = useRef<HTMLSpanElement>(null)
    const highRef = useRef<HTMLSpanElement>(null)
    const lowRef = useRef<HTMLSpanElement>(null)
    const closeRef = useRef<HTMLSpanElement>(null)
    const lastInfoRef = useRef<CrosshairInfo>({})

    // Expose update method via ref for direct DOM manipulation (no React re-render)
    useImperativeHandle(ref, () => ({
      update: (info: CrosshairInfo) => {
        if (!containerRef.current) return

        // Show/hide container based on data availability
        if (!info.OHLC) {
          containerRef.current.style.display = 'none'
          lastInfoRef.current = {}
          return
        }

        containerRef.current.style.display = 'block'

        // Update date
        if (dateRef.current && info.time !== lastInfoRef.current.time) {
          dateRef.current.textContent = formatDate(info.time || '')
        }

        // Update OHLC values directly via DOM
        if (info.OHLC) {
          if (openRef.current && info.OHLC.open !== lastInfoRef.current.OHLC?.open) {
            openRef.current.textContent = formatPrice(info.OHLC.open)
          }
          if (highRef.current && info.OHLC.high !== lastInfoRef.current.OHLC?.high) {
            highRef.current.textContent = formatPrice(info.OHLC.high)
          }
          if (lowRef.current && info.OHLC.low !== lastInfoRef.current.OHLC?.low) {
            lowRef.current.textContent = formatPrice(info.OHLC.low)
          }
          if (closeRef.current) {
            const closeChanged = info.OHLC.close !== lastInfoRef.current.OHLC?.close
            const directionChanged = lastInfoRef.current.OHLC &&
              (info.OHLC.close >= info.OHLC.open) !== (lastInfoRef.current.OHLC.close >= lastInfoRef.current.OHLC.open)

            if (closeChanged || directionChanged) {
              closeRef.current.textContent = formatPrice(info.OHLC.close)
              // Update color class based on bullish/bearish
              const isBullish = info.OHLC.close >= info.OHLC.open
              closeRef.current.className = isBullish
                ? 'text-[var(--neon-bull)]'
                : 'text-[var(--neon-bear)]'
            }
          }
        }

        lastInfoRef.current = info
      }
    }), [])

    // Initialize hidden state
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.style.display = 'none'
      }
    }, [])

    return (
      <div
        ref={containerRef}
        className="absolute top-3 left-3 bg-[var(--bg-overlay)]/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs border border-[var(--border-primary)]/20 shadow-lg"
        style={{ display: 'none' }}
      >
        <div className="flex items-center gap-3">
          <span ref={dateRef} className="text-[var(--text-muted)]" />
          <span className="text-[var(--text-primary)]">
            O: <span ref={openRef} className="text-[var(--text-muted)]" />
          </span>
          <span className="text-[var(--text-primary)]">
            H: <span ref={highRef} className="text-[var(--text-muted)]" />
          </span>
          <span className="text-[var(--text-primary)]">
            L: <span ref={lowRef} className="text-[var(--text-muted)]" />
          </span>
          <span className="text-[var(--text-primary)]">
            C: <span ref={closeRef} className="text-[var(--neon-bull)]" />
          </span>
        </div>
      </div>
    )
  }
)
