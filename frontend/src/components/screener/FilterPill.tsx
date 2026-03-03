import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import type { DynamicFilter, FilterFieldOption } from '../../types'

interface FilterPillProps {
  filter: DynamicFilter
  fieldOption: FilterFieldOption | undefined
  onEdit: (filter: DynamicFilter) => void
  onRemove: (id: string) => void
}

const operatorSymbols: Record<string, string> = {
  '>=': '≥',
  '<=': '≤',
  '>': '>',
  '<': '<',
  '=': '=',
}

export function FilterPill({ filter, fieldOption, onEdit, onRemove }: FilterPillProps) {
  const operatorSymbol = operatorSymbols[filter.operator] || filter.operator

  return (
    <div
      className="group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-md text-[13px] text-[var(--text-primary)] animate-fade-in hover:border-[var(--border-glow)]"
      title={fieldOption?.description}
    >
      <span className="font-semibold text-[var(--neon-cyan)]">{fieldOption?.shortLabel || filter.field}</span>
      <span className="text-[var(--text-secondary)] text-[11px] uppercase">{operatorSymbol}</span>
      <span className="font-medium font-mono">{filter.value}</span>
      <div className="flex items-center gap-0.5 ml-1">
        <button
          className={cn(
            'flex items-center justify-center w-6 h-6 p-0 bg-transparent border-none rounded cursor-pointer transition-all duration-150',
            'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-cyan)]',
            '[&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:flex-shrink-0'
          )}
          onClick={() => onEdit(filter)}
          type="button"
          aria-label="Edit filter"
        >
          <Icons.Settings2 />
        </button>
        <button
          className={cn(
            'flex items-center justify-center w-6 h-6 p-0 bg-transparent border-none rounded cursor-pointer transition-all duration-150',
            'text-[var(--text-muted)] hover:bg-[var(--neon-bear-dim)] hover:text-[var(--neon-bear)]',
            '[&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:flex-shrink-0'
          )}
          onClick={() => onRemove(filter.id)}
          type="button"
          aria-label="Remove filter"
        >
          <Icons.X />
        </button>
      </div>
    </div>
  )
}
