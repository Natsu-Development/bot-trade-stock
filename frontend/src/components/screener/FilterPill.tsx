import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import { isMAField, isSignalField, MA_OPERATOR_LABELS } from '@/lib/screenerFilterOptions'
import type { DynamicFilter, FilterFieldOption } from '../../types'

interface FilterPillProps {
  filter: DynamicFilter
  fieldOption: FilterFieldOption | undefined
  onEdit?: (filter: DynamicFilter) => void
  onRemove?: (id: string) => void
  /** Compact layout for dense UIs (e.g. config preset modal) */
  variant?: 'default' | 'compact'
  /** Hide edit/remove buttons for read-only display */
  hideActions?: boolean
}

const operatorSymbols: Record<string, string> = {
  '>=': '≥',
  '<=': '≤',
  '>': '>',
  '<': '<',
  '=': '=',
}

export function FilterPill({
  filter,
  fieldOption,
  onEdit,
  onRemove,
  variant = 'default',
  hideActions = false,
}: FilterPillProps) {
  const operatorSymbol = operatorSymbols[filter.operator] || filter.operator
  const isCompact = variant === 'default' ? false : variant === 'compact'
  const isMA = isMAField(filter.field)

  // For MA fields, show "Price Above/Below EMA50" format
  const renderFilterContent = () => {
    if (isMA) {
      return (
        <>
          <span className="font-semibold text-[var(--neon-cyan)]">Price</span>
          <span className={cn(isCompact ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)] text-[11px] uppercase')}>
            {MA_OPERATOR_LABELS[filter.operator]}
          </span>
          <span className="font-semibold text-[var(--neon-cyan)]">{fieldOption?.shortLabel || filter.field}</span>
        </>
      )
    }

    // For signal fields, show "Has/No Bullish RSI" format
    if (isSignalField(filter.field)) {
      const hasSignal = filter.value === true
      return (
        <>
          <span className="font-semibold text-[var(--neon-cyan)]">
            {hasSignal ? 'Has' : 'No'}
          </span>
          <span className={cn(isCompact ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]')}>
            {fieldOption?.shortLabel || filter.field}
          </span>
        </>
      )
    }

    return (
      <>
        <span className="font-semibold text-[var(--neon-cyan)]">{fieldOption?.shortLabel || filter.field}</span>
        <span className={cn(isCompact ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)] text-[11px] uppercase')}>
          {isCompact ? filter.operator : operatorSymbol}
        </span>
        <span className={cn('font-mono', isCompact ? 'font-medium' : 'font-medium')}>{filter.value}</span>
      </>
    )
  }

  return (
    <div
      className={cn(
        'group relative inline-flex items-center border border-[var(--border-dim)] rounded text-[var(--text-primary)]',
        isCompact
          ? 'gap-1 px-2 py-1 bg-[var(--bg-deep)] text-xs'
          : 'gap-1.5 px-2.5 py-1.5 bg-[var(--bg-elevated)] text-[13px] animate-fade-in hover:border-[var(--border-glow)]'
      )}
      title={fieldOption?.description}
    >
      {renderFilterContent()}
      {!hideActions && (
        <div className={cn('flex items-center', isCompact ? 'gap-0 ml-0.5' : 'gap-0.5 ml-1')}>
          <button
            className={cn(
              'flex items-center justify-center p-0 bg-transparent border-none rounded cursor-pointer transition-all duration-150',
              'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-cyan)]',
              isCompact ? 'p-0.5 [&_svg]:w-3 [&_svg]:h-3' : 'w-6 h-6 [&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:flex-shrink-0'
            )}
            onClick={() => onEdit?.(filter)}
            type="button"
            aria-label="Edit filter"
          >
            <Icons.Settings2 />
          </button>
          <button
            className={cn(
              'flex items-center justify-center p-0 bg-transparent border-none rounded cursor-pointer transition-all duration-150',
              'text-[var(--text-muted)] hover:bg-[var(--neon-bear-dim)] hover:text-[var(--neon-bear)]',
              isCompact ? 'p-0.5 [&_svg]:w-3 [&_svg]:h-3' : 'w-6 h-6 [&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:flex-shrink-0'
            )}
            onClick={() => onRemove?.(filter.id)}
            type="button"
            aria-label="Remove filter"
          >
            <Icons.X />
          </button>
        </div>
      )}
    </div>
  )
}
