import { memo, useCallback } from 'react'
import { Icons } from '../icons/Icons'
import { cn } from '@/lib/utils'
import type { ApiStockAlert } from '@/lib/api'
import {
  countActiveConditions,
  formatConditionPill,
  getConditionCategory,
  getConditionSentiment,
  isAlertActive,
} from '@/lib/alertOptions'

interface StockAlertRowProps {
  alert: ApiStockAlert
  index: number
  onEdit: (index: number) => void
  onDelete: (index: number) => void
}

const SENTIMENT_PILL = {
  bull: 'bg-[var(--neon-bull-dim)] border-[rgba(0,255,136,0.25)] text-[var(--neon-bull)]',
  bear: 'bg-[var(--neon-bear-dim)] border-[rgba(255,51,102,0.25)] text-[var(--neon-bear)]',
  neutral: 'bg-[var(--neon-cyan-dim)] border-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]',
} as const

const SENTIMENT_PILL_DIM = {
  bull: 'bg-[var(--bg-deep)] border-[var(--border-dim)] text-[var(--text-muted)]',
  bear: 'bg-[var(--bg-deep)] border-[var(--border-dim)] text-[var(--text-muted)]',
  neutral: 'bg-[var(--bg-deep)] border-[var(--border-dim)] text-[var(--text-muted)]',
} as const

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
  const isPaused = activeCount === 0

  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-3 py-2.5 rounded-md border transition-all duration-150',
        'bg-[var(--bg-surface)]',
        active
          ? 'border-[var(--border-dim)] hover:border-[var(--border-glow)]'
          : 'border-[var(--border-dim)] opacity-65'
      )}
    >
      {/* Top row: symbol chip + status + actions */}
      <div className="flex items-center gap-2.5">
        {/* Symbol chip */}
        <span className="inline-flex items-center px-2 py-0.5 bg-[var(--bg-deep)] border border-[var(--neon-cyan-dim)] rounded font-mono text-xs font-semibold text-[var(--neon-cyan)] shrink-0">
          {alert.symbol}
        </span>

        {/* Active/total + paused badge */}
        <span
          className={cn(
            'text-[10px] font-mono shrink-0',
            isPaused ? 'text-[var(--neon-amber)]' : 'text-[var(--text-muted)]'
          )}
        >
          {isPaused ? (
            <span className="inline-flex items-center gap-1">
              <Icons.Clock className="w-3 h-3" />
              0/{total} active — paused
            </span>
          ) : (
            `${activeCount}/${total} active`
          )}
        </span>

        <div className="flex-1" />

        {/* Edit button */}
        <button
          type="button"
          onClick={handleEdit}
          aria-label={`Edit alert for ${alert.symbol}`}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-cyan)] transition-colors duration-150 [&_svg]:w-3.5 [&_svg]:h-3.5"
        >
          <Icons.Settings2 />
        </button>

        {/* Delete button */}
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Delete alert for ${alert.symbol}`}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-bear)] transition-colors duration-150 [&_svg]:w-3.5 [&_svg]:h-3.5"
        >
          <Icons.Trash2 />
        </button>
      </div>

      {/* Condition pills row */}
      {alert.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-0.5">
          {alert.conditions.map((c, i) => {
            const sentiment = getConditionSentiment(c.type)
            const category = getConditionCategory(c.type)
            const CategoryIcon = category
              ? Icons[category.iconName as keyof typeof Icons]
              : null
            const pillClass = c.enabled
              ? SENTIMENT_PILL[sentiment]
              : SENTIMENT_PILL_DIM[sentiment]

            return (
              <span
                key={i}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono transition-colors duration-150',
                  pillClass
                )}
                title={c.enabled ? 'Enabled' : 'Disabled'}
              >
                {CategoryIcon && (
                  <CategoryIcon className="w-2.5 h-2.5 flex-shrink-0 opacity-80" />
                )}
                <span aria-hidden className="opacity-60">
                  {c.enabled ? '●' : '○'}
                </span>
                {formatConditionPill(c)}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
})
