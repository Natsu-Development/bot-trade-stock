import { memo, useCallback } from 'react'
import { Icons } from '../icons/Icons'
import { cn } from '@/lib/utils'
import type { ApiStockAlert } from '@/lib/api'
import { countActiveConditions, isAlertActive } from '@/lib/alertOptions'
import { StockAlertStatusBadge } from './StockAlertStatusBadge'
import { StockAlertCategoryChips } from './StockAlertCategoryChips'

interface StockAlertRowProps {
  alert: ApiStockAlert
  index: number
  expanded: boolean
  panelId: string
  onToggle: (symbol: string) => void
  onEdit: (index: number) => void
  onDelete: (index: number) => void
}

/**
 * Collapsed single-line summary row, laid out on the shared `.alert-row-grid`
 * fixed column tracks: SYMBOL | STATUS | WATCHING | ON/TOTAL | CHEVRON | ACTIONS.
 * The WATCHING cell clips (never wraps) so every row is exactly one line tall.
 */
export const StockAlertRow = memo(function StockAlertRow({
  alert,
  index,
  expanded,
  panelId,
  onToggle,
  onEdit,
  onDelete,
}: StockAlertRowProps) {
  const handleEdit = useCallback(() => onEdit(index), [index, onEdit])
  const handleDelete = useCallback(() => onDelete(index), [index, onDelete])
  const handleToggle = useCallback(() => onToggle(alert.symbol), [alert.symbol, onToggle])

  const active = isAlertActive(alert)
  const { active: activeCount, total } = countActiveConditions(alert)
  const paused = !active

  return (
    <div className={cn('alert-row-grid px-3 py-2', !active && 'opacity-65')}>
      {/* SYMBOL */}
      <span className="inline-flex items-center justify-self-start px-2 py-0.5 bg-[var(--bg-deep)] border border-[var(--neon-cyan-dim)] rounded font-mono text-xs font-semibold text-[var(--neon-cyan)]">
        {alert.symbol}
      </span>

      {/* STATUS */}
      <StockAlertStatusBadge paused={paused} />

      {/* WATCHING */}
      <StockAlertCategoryChips alert={alert} />

      {/* ON/TOTAL */}
      <span
        className={cn(
          'text-[11px] font-mono tabular-nums whitespace-nowrap',
          paused ? 'text-[var(--neon-amber)]' : 'text-[var(--text-secondary)]'
        )}
      >
        {activeCount}/{total}
      </span>

      {/* CHEVRON */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} conditions for ${alert.symbol}`}
        className={cn(
          'w-7 h-7 flex items-center justify-center justify-self-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-cyan)] transition-transform duration-150 motion-reduce:transition-none [&_svg]:w-4 [&_svg]:h-4',
          expanded && 'rotate-90'
        )}
      >
        <Icons.ChevronRight />
      </button>

      {/* ACTIONS */}
      <div className="flex items-center justify-self-end gap-1">
        <button
          type="button"
          onClick={handleEdit}
          aria-label={`Edit alert for ${alert.symbol}`}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-cyan)] transition-colors duration-150 [&_svg]:w-3.5 [&_svg]:h-3.5"
        >
          <Icons.Settings2 />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Delete alert for ${alert.symbol}`}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-bear)] transition-colors duration-150 [&_svg]:w-3.5 [&_svg]:h-3.5"
        >
          <Icons.Trash2 />
        </button>
      </div>
    </div>
  )
})
