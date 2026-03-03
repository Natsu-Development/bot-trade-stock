import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import { FilterPill } from './FilterPill'
import { FilterEditor } from './FilterEditor'
import { QuickPresets } from './QuickPresets'
import type { DynamicFilter, FilterField, FilterFieldOption, FilterOperatorOption, QuickPreset } from '../../types'

interface FilterBarProps {
  filters: DynamicFilter[]
  fieldOptions: FilterFieldOption[]
  operatorOptions: FilterOperatorOption[]
  filterLogic: 'and' | 'or'
  activeExchange: string
  onFiltersChange: (filters: DynamicFilter[]) => void
  onLogicChange: (logic: 'and' | 'or') => void
  onExchangeChange: (exchange: string) => void
  onReset: () => void
  onSavePreset?: () => void
}

const builtInPresets: QuickPreset[] = [
  {
    id: 'momentum',
    name: 'Momentum',
    icon: '🚀',
    filters: [
      { field: 'rs_52w', operator: '>=', value: 80 },
      { field: 'rs_3m', operator: '>=', value: 75 },
      { field: 'volume_vs_sma', operator: '>=', value: 30 },
    ],
  },
  {
    id: 'breakout',
    name: 'Breakout',
    icon: '⚡',
    filters: [
      { field: 'rs_52w', operator: '>=', value: 70 },
      { field: 'volume_vs_sma', operator: '>=', value: 80 },
    ],
  },
  {
    id: 'trending-up',
    name: 'Trending Up',
    icon: '📈',
    filters: [
      { field: 'rs_52w', operator: '>=', value: 70 },
      { field: 'rs_6m', operator: '>=', value: 70 },
      { field: 'rs_3m', operator: '>=', value: 70 },
    ],
  },
  {
    id: 'volume-surge',
    name: 'Volume Surge',
    icon: '📊',
    filters: [{ field: 'volume_vs_sma', operator: '>=', value: 150 }],
  },
  {
    id: 'swing-trade',
    name: 'Swing Trade',
    icon: '🔄',
    filters: [
      { field: 'rs_52w', operator: '>=', value: 60 },
      { field: 'rs_52w', operator: '<=', value: 85 },
      { field: 'volume_vs_sma', operator: '>=', value: 50 },
    ],
  },
]

const exchanges = ['All', 'HOSE', 'HNX', 'UPCOM'] as const

export function FilterBar({
  filters,
  fieldOptions,
  operatorOptions,
  filterLogic,
  activeExchange,
  onFiltersChange,
  onLogicChange,
  onExchangeChange,
  onReset: _onReset,
  onSavePreset,
}: FilterBarProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingFilter, setEditingFilter] = useState<DynamicFilter | null>(null)
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  const handleAddFilter = () => {
    setEditingFilter(null)
    setIsEditorOpen(true)
  }

  const handleEditFilter = (filter: DynamicFilter) => {
    setEditingFilter(filter)
    setIsEditorOpen(true)
  }

  const handleRemoveFilter = (id: string) => {
    onFiltersChange(filters.filter(f => f.id !== id))
    setActivePresetId(null)
  }

  const handleSaveFilter = (filter: DynamicFilter) => {
    if (editingFilter) {
      onFiltersChange(filters.map(f => f.id === editingFilter.id ? filter : f))
    } else {
      onFiltersChange([...filters, filter])
    }
    setActivePresetId(null)
  }

  const handleSelectPreset = (preset: QuickPreset) => {
    setActivePresetId(preset.id)
    const newFilters: DynamicFilter[] = preset.filters.map((f, index) => ({
      id: `preset_${preset.id}_${index}`,
      field: f.field,
      operator: f.operator,
      value: f.value,
    }))
    onFiltersChange(newFilters)
    if (preset.filters.length > 1) {
      onLogicChange('and')
    }
  }

  const getFieldOption = (field: FilterField) => {
    return fieldOptions.find(o => o.value === field)
  }

  return (
    <div className="flex flex-col gap-4">
      <QuickPresets
        presets={builtInPresets}
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        onSaveCurrent={onSavePreset || (() => {})}
      />

      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {exchanges.map((exchange) => (
            <button
              key={exchange}
              className={cn(
                'px-3.5 py-1.5 text-[13px] font-medium rounded transition-all duration-200',
                'bg-[var(--bg-elevated)] border border-[var(--border-dim)] text-[var(--text-secondary)]',
                'hover:bg-[var(--bg-hover)]',
                activeExchange === exchange && 'bg-[var(--neon-cyan-dim)] border-[var(--neon-cyan)] text-[var(--neon-cyan)]'
              )}
              onClick={() => onExchangeChange(exchange)}
              type="button"
            >
              {exchange}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded">
          <span className="text-xs font-medium text-[var(--text-muted)] mr-1">Match</span>
          <button
            className={cn(
              'px-4 py-1.5 bg-transparent border-none rounded text-[13px] font-medium text-[var(--text-secondary)] cursor-pointer transition-all duration-200',
              'hover:text-[var(--text-primary)]',
              filterLogic === 'and' && 'bg-[var(--neon-cyan)] text-[var(--bg-void)]'
            )}
            onClick={() => onLogicChange('and')}
            type="button"
          >
            All
          </button>
          <button
            className={cn(
              'px-4 py-1.5 bg-transparent border-none rounded text-[13px] font-medium text-[var(--text-secondary)] cursor-pointer transition-all duration-200',
              'hover:text-[var(--text-primary)]',
              filterLogic === 'or' && 'bg-[var(--neon-cyan)] text-[var(--bg-void)]'
            )}
            onClick={() => onLogicChange('or')}
            type="button"
          >
            Any
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">Active Filters</span>
          {filters.length > 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              {filters.filter(f => f.value !== '').length} filter(s)
            </span>
          )}
        </div>

        {filters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center border-2 border-dashed border-[var(--border-dim)] rounded-md text-[var(--text-muted)]">
            <Icons.Filter className="w-10 h-10 mb-3 opacity-40 flex-shrink-0" />
            <p className="m-0 text-[13px]">No filters added. Click "Add Filter" to create conditions.</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 min-h-[40px]">
            {filters.map((filter) => (
              <FilterPill
                key={filter.id}
                filter={filter}
                fieldOption={getFieldOption(filter.field)}
                onEdit={handleEditFilter}
                onRemove={handleRemoveFilter}
              />
            ))}
            <button
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-transparent border border-dashed border-[var(--border-dim)] rounded-md text-[13px] font-medium text-[var(--text-muted)] cursor-pointer transition-all duration-200 hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan-dim)] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:flex-shrink-0"
              onClick={handleAddFilter}
              type="button"
            >
              <Icons.Plus />
              <span>Add Filter</span>
            </button>
          </div>
        )}
      </div>

      <FilterEditor
        isOpen={isEditorOpen}
        filter={editingFilter}
        fieldOptions={fieldOptions}
        operatorOptions={operatorOptions}
        onSave={handleSaveFilter}
        onClose={() => setIsEditorOpen(false)}
      />
    </div>
  )
}
