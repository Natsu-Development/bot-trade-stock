import { memo, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import type { ScreenerFilterPreset } from '@/lib/api'
import type { FilterFieldOption } from '@/types'

interface FilterPresetCardProps {
  preset: ScreenerFilterPreset
  fieldOptions: FilterFieldOption[]
  onEdit: (preset: ScreenerFilterPreset) => void
  onDelete: (name: string) => void
}

const operatorSymbols: Record<string, string> = {
  '>=': '≥',
  '<=': '≤',
  '>': '>',
  '<': '<',
  '=': '=',
}

export const FilterPresetCard = memo(function FilterPresetCard({ preset, fieldOptions, onEdit, onDelete }: FilterPresetCardProps) {
  // Memoize the field lookup map for O(1) access
  const fieldOptionsMap = useMemo(() => {
    return new Map<string, FilterFieldOption>(fieldOptions.map(o => [o.value, o]))
  }, [fieldOptions])

  const getFieldLabel = useCallback((field: string) => {
    const option = fieldOptionsMap.get(field)
    return option?.shortLabel || field
  }, [fieldOptionsMap])

  return (
    <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-lg hover:border-[var(--border-glow)] transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">{preset.name}</h4>
          <span
            className={cn(
              'px-2 py-0.5 text-[10px] font-medium rounded uppercase',
              preset.logic === 'and'
                ? 'bg-[var(--neon-bull-dim)] text-[var(--neon-bull)]'
                : 'bg-[var(--neon-bear-dim)] text-[var(--neon-bear)]'
            )}
          >
            {preset.logic === 'and' ? 'All' : 'Any'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--neon-cyan)] hover:bg-[var(--bg-hover)] rounded transition-all duration-150"
            onClick={() => onEdit(preset)}
            type="button"
            aria-label="Edit preset"
          >
            <Icons.Settings2 className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--neon-bear)] hover:bg-[var(--bg-hover)] rounded transition-all duration-150"
            onClick={() => onDelete(preset.name)}
            type="button"
            aria-label="Delete preset"
          >
            <Icons.Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter conditions */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {preset.filters.map((filter, index) => (
          <div
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--bg-deep)] border border-[var(--border-dim)] rounded text-[12px]"
          >
            <span className="font-semibold text-[var(--neon-cyan)]">{getFieldLabel(filter.field)}</span>
            <span className="text-[var(--text-muted)]">{operatorSymbols[filter.op] || filter.op}</span>
            <span className="font-mono text-[var(--text-primary)]">{filter.value}</span>
          </div>
        ))}
      </div>

      {/* Exchanges */}
      {preset.exchanges && preset.exchanges.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)]">Exchanges:</span>
          <div className="flex gap-1">
            {preset.exchanges.map((exchange) => (
              <span
                key={exchange}
                className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--bg-deep)] border border-[var(--border-dim)] rounded text-[var(--text-secondary)]"
              >
                {exchange}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})