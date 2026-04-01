import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import { FilterPill } from '../screener/FilterPill'
import type { ScreenerFilterPreset } from '@/lib/api'
import type { FilterFieldOption, DynamicFilter } from '@/types'

interface FilterPresetCardProps {
  preset: ScreenerFilterPreset
  fieldOptions: FilterFieldOption[]
  onEdit: (preset: ScreenerFilterPreset) => void
  onDelete: (name: string) => void
}

export const FilterPresetCard = memo(function FilterPresetCard({ preset, fieldOptions, onEdit, onDelete }: FilterPresetCardProps) {
  const fieldOptionsMap = useMemo(() => {
    return new Map<string, FilterFieldOption>(fieldOptions.map(o => [o.value, o]))
  }, [fieldOptions])

  const dynamicFilters = useMemo(() => {
    return preset.filters.map((f, index) => ({
      id: `preset-${index}`,
      field: f.field,
      operator: f.op,
      value: f.value,
    })) as DynamicFilter[]
  }, [preset.filters])

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
        {dynamicFilters.map((filter) => (
          <FilterPill
            key={filter.id}
            filter={filter}
            fieldOption={fieldOptionsMap.get(filter.field)}
            variant="compact"
            hideActions
          />
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