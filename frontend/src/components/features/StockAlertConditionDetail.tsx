import { memo, useCallback } from 'react'
import { Icons } from '../icons/Icons'
import { cn } from '@/lib/utils'
import type { ApiStockAlert } from '@/lib/api'
import {
  formatConditionPill,
  getConditionSentiment,
  groupConditionsByCategory,
} from '@/lib/alertOptions'
import { SENTIMENT_BAR } from '@/lib/alertStyles'

interface StockAlertConditionDetailProps {
  alert: ApiStockAlert
  index: number
  panelId: string
  onEdit: (index: number) => void
}

/**
 * Expanded, read-mostly per-condition panel. Conditions are grouped by category
 * (via groupConditionsByCategory); each group carries a 3px left accent bar
 * colored by SENTIMENT (shared SENTIMENT_BAR). Each condition shows a fill dot —
 * solid `●` when enabled, hollow `○` (dimmed) when disabled — plus its threshold
 * text from formatConditionPill. Read-only: all edits route to the modal.
 */
export const StockAlertConditionDetail = memo(function StockAlertConditionDetail({
  alert,
  index,
  panelId,
  onEdit,
}: StockAlertConditionDetailProps) {
  const handleEdit = useCallback(() => onEdit(index), [index, onEdit])
  const groups = groupConditionsByCategory(alert)

  return (
    <div
      id={panelId}
      role="region"
      aria-label={`Conditions for ${alert.symbol}`}
      className="flex flex-col gap-3 pl-[14.5rem] pr-3 py-3 bg-[var(--bg-deep)] border-t border-[var(--border-dim)] animate-fade-in motion-reduce:animate-none"
    >
      {groups.length === 0 ? (
        <p className="text-[11px] text-[var(--text-muted)] italic">No conditions configured.</p>
      ) : (
        groups.map(({ category, conditions }) => {
          const sentiment = getConditionSentiment(conditions[0].type)
          return (
            <div key={category.id} className="relative pl-3">
              <div
                className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded', SENTIMENT_BAR[sentiment])}
                aria-hidden="true"
              />
              <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                {category.label}
              </span>
              <ul className="flex flex-col gap-1 mt-1" role="list">
                {conditions.map((cond, i) => (
                  <li
                    key={`${cond.type}:${cond.reference ?? ''}:${i}`}
                    className={cn(
                      'flex items-center gap-2 text-[11px] font-mono leading-relaxed',
                      cond.enabled
                        ? 'text-[var(--text-secondary)]'
                        : 'opacity-55 text-[var(--text-muted)]'
                    )}
                  >
                    <span aria-hidden="true" className="shrink-0">
                      {cond.enabled ? '●' : '○'}
                    </span>
                    <span className="min-w-0">{formatConditionPill(cond)}</span>
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider">
                      {cond.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleEdit}
          aria-label={`Edit alert for ${alert.symbol} in modal`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--border-glow)] text-[10px] font-mono text-[var(--text-secondary)] hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] transition-colors duration-150 [&_svg]:w-3 [&_svg]:h-3"
        >
          <Icons.Settings2 />
          Edit in modal
        </button>
      </div>
    </div>
  )
})
