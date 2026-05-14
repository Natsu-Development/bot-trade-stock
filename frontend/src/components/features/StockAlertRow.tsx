import { memo, useCallback } from 'react'
import { Icons } from '../icons/Icons'
import { cn } from '@/lib/utils'
import type { ApiStockAlert } from '@/lib/api'
import { countActiveConditions, formatConditionPill, isAlertActive } from '@/lib/alertOptions'

interface StockAlertRowProps {
  alert: ApiStockAlert
  index: number
  onEdit: (index: number) => void
  onDelete: (index: number) => void
}

export const StockAlertRow = memo(function StockAlertRow({
  alert,
  index,
  onEdit,
  onDelete,
}: StockAlertRowProps) {
  const handleEdit = useCallback(() => onEdit(index), [index, onEdit])
  const handleDelete = useCallback(() => onDelete(index), [index, onDelete])

  const active = isAlertActive(alert)
  const { active: activeCount, total } = countActiveConditions(alert)

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 px-3 py-2.5 bg-[var(--bg-elevated)] border rounded-md transition-colors',
        active
          ? 'border-[var(--border-dim)] hover:border-[var(--border-glow)]'
          : 'border-[var(--border-dim)] opacity-70'
      )}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center px-2.5 py-1 bg-[var(--bg-deep)] border border-[var(--neon-cyan-dim)] rounded font-mono text-xs font-semibold text-[var(--neon-cyan)] shrink-0">
          {alert.symbol}
        </span>

        <span
          className={cn(
            'text-[11px] font-mono',
            activeCount === 0 ? 'text-[var(--text-warning,var(--text-muted))]' : 'text-[var(--text-muted)]'
          )}
        >
          {activeCount === 0 ? `0/${total} active — paused` : `${activeCount}/${total} active`}
        </span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleEdit}
          aria-label={`Edit alert for ${alert.symbol}`}
          className="w-8 h-8 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-cyan)] [&_svg]:w-4 [&_svg]:h-4"
        >
          <Icons.Settings2 />
        </button>

        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Delete alert for ${alert.symbol}`}
          className="w-8 h-8 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-bear)] [&_svg]:w-4 [&_svg]:h-4"
        >
          <Icons.Trash2 />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 pl-1">
        {alert.conditions.map((c, i) => (
          <span
            key={i}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border',
              c.enabled
                ? 'bg-[var(--neon-cyan-dim)]/30 border-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]'
                : 'bg-[var(--bg-deep)] border-[var(--border-dim)] text-[var(--text-muted)]'
            )}
            title={c.enabled ? 'Enabled' : 'Disabled'}
          >
            <span aria-hidden>{c.enabled ? '●' : '○'}</span>
            {formatConditionPill(c)}
          </span>
        ))}
      </div>
    </div>
  )
})
