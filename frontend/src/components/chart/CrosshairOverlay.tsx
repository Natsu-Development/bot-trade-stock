import { memo } from 'react'
import { cn } from '@/lib/utils'

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

export interface CrosshairOverlayProps {
  crosshairInfo: CrosshairInfo
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatPrice = (value: number): string => {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const CrosshairOverlay = memo(function CrosshairOverlay({ crosshairInfo }: CrosshairOverlayProps) {
  if (!crosshairInfo.OHLC) return null

  return (
    <div className="absolute top-3 left-3 bg-[var(--bg-overlay)]/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs border border-[var(--border-primary)]/20 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-muted)]">{formatDate(crosshairInfo.time || '')}</span>
        <span className="text-[var(--text-primary)]">
          O: <span className="text-[var(--text-muted)]">{formatPrice(crosshairInfo.OHLC.open)}</span>
        </span>
        <span className="text-[var(--text-primary)]">
          H: <span className="text-[var(--text-muted)]">{formatPrice(crosshairInfo.OHLC.high)}</span>
        </span>
        <span className="text-[var(--text-primary)]">
          L: <span className="text-[var(--text-muted)]">{formatPrice(crosshairInfo.OHLC.low)}</span>
        </span>
        <span className="text-[var(--text-primary)]">
          C: <span className={cn(
            crosshairInfo.OHLC.close >= crosshairInfo.OHLC.open ? 'text-[var(--neon-bull)]' : 'text-[var(--neon-bear)]'
          )}>{formatPrice(crosshairInfo.OHLC.close)}</span>
        </span>
      </div>
    </div>
  )
})
