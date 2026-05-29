import { memo } from 'react'
import { cn } from '@/lib/utils'

interface StockAlertStatusBadgeProps {
  paused: boolean
}

/**
 * Hue-only STATUS badge: green `● ACTIVE` / amber `● PAUSED`. The dot encodes
 * status via hue only; the adjacent text keeps the meaning legible without
 * relying on color alone. This is the single paused indicator — it replaces the
 * old amber "0/N active — paused" text + Clock affordance in the row.
 */
export const StockAlertStatusBadge = memo(function StockAlertStatusBadge({
  paused,
}: StockAlertStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider whitespace-nowrap',
        paused ? 'text-[var(--neon-amber)]' : 'text-[var(--neon-bull)]'
      )}
    >
      <span aria-hidden="true" className="text-[8px] leading-none">
        ●
      </span>
      {paused ? 'PAUSED' : 'ACTIVE'}
    </span>
  )
})
