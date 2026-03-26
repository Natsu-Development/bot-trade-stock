import { useState, useCallback, useMemo, memo, useDeferredValue } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FilterPresetCard } from './FilterPresetCard'
import { FilterEditor } from '../screener/FilterEditor'
import { FilterPill } from '../screener/FilterPill'
import type { ScreenerFilterPreset } from '@/lib/api'
import {
  SCREENER_EXCHANGES,
  SCREENER_FIELD_OPTIONS,
  SCREENER_OPERATOR_OPTIONS,
  isValidFilterOperator,
} from '@/lib/screenerFilterOptions'
import { generateId } from '@/lib/id'
import type { DynamicFilter, FilterFieldOption, FilterField, FilterOperator } from '@/types'

interface MetricsFilterSectionProps {
  filters: ScreenerFilterPreset[]
  onUpdate: (filters: ScreenerFilterPreset[]) => void
}

// Memoized preset card wrapper
const MemoizedFilterPresetCard = memo(FilterPresetCard)

export function MetricsFilterSection({ filters, onUpdate }: MetricsFilterSectionProps) {
  // State for preset creation/editing
  const [showPresetModal, setShowPresetModal] = useState(false)
  const [editingPreset, setEditingPreset] = useState<ScreenerFilterPreset | null>(null)

  // Initial data for modal - stable reference
  const modalInitialData = useMemo(() => {
    if (editingPreset) {
      return {
        name: editingPreset.name,
        logic: editingPreset.logic || 'and',
        exchanges: editingPreset.exchanges || [],
        filters: editingPreset.filters.map((f, index) => ({
          id: generateId() + index,
          field: f.field as FilterField,
          operator: f.op as FilterOperator,
          value: f.value,
        })),
        editingPreset,
      }
    }
    return {
      name: '',
      logic: 'and' as const,
      exchanges: [],
      filters: [],
      editingPreset: null,
    }
  }, [editingPreset])

  const handleAddPreset = useCallback(() => {
    setEditingPreset(null)
    setShowPresetModal(true)
  }, [])

  const handleEditPreset = useCallback((preset: ScreenerFilterPreset) => {
    setEditingPreset(preset)
    setShowPresetModal(true)
  }, [])

  const handleDeletePreset = useCallback((name: string) => {
    onUpdate(filters.filter(f => f.name !== name))
  }, [filters, onUpdate])

  const closeModal = useCallback(() => {
    setShowPresetModal(false)
    setEditingPreset(null)
  }, [])

  const handleSavePreset = useCallback((data: {
    name: string
    logic: 'and' | 'or'
    exchanges: string[]
    filters: DynamicFilter[]
    editingPreset: ScreenerFilterPreset | null
  }) => {
    if (!data.name.trim()) return

    const newPreset: ScreenerFilterPreset = {
      name: data.name.trim(),
      filters: data.filters
        .filter(f => f.value !== '' && !isNaN(Number(f.value)) && isValidFilterOperator(f.operator))
        .map(f => ({
          field: f.field,
          op: f.operator,
          value: Number(f.value),
        })),
      logic: data.logic,
      exchanges: data.exchanges.length > 0 ? data.exchanges : undefined,
      created_at: data.editingPreset?.created_at || new Date().toISOString(),
    }

    let updatedFilters: ScreenerFilterPreset[]
    if (data.editingPreset) {
      updatedFilters = filters.map(f => f.name === data.editingPreset!.name ? newPreset : f)
    } else {
      if (filters.some(f => f.name === data.name.trim())) {
        updatedFilters = filters.map(f => f.name === data.name.trim() ? newPreset : f)
      } else {
        updatedFilters = [...filters, newPreset]
      }
    }

    onUpdate(updatedFilters)
    setShowPresetModal(false)
    setEditingPreset(null)
  }, [filters, onUpdate])

  // Memoize field lookup map for O(1) access
  const fieldOptionsMap = useMemo(() => {
    return new Map(SCREENER_FIELD_OPTIONS.map(o => [o.value, o]))
  }, [])

  return (
    <Card className="mb-6">
      <Card.Body>
        <div className="config-section !mb-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="config-section-title !mb-0">
              <Icons.Filter />
              <span>Metrics Filter Presets</span>
            </h3>
            <Button variant="secondary" icon="Plus" onClick={handleAddPreset}>
              <span>Add Preset</span>
            </Button>
          </div>

          <p className="text-sm text-[var(--text-muted)] mb-4">
            Save and manage screener filter presets for quick access when scanning stocks.
          </p>

          {filters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-[var(--border-dim)] rounded-lg">
              <Icons.Filter className="w-10 h-10 mb-3 opacity-40 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)] mb-2">No filter presets saved</p>
              <p className="text-xs text-[var(--text-muted)]">Create presets to quickly apply filter combinations</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filters.map((preset) => (
                <MemoizedFilterPresetCard
                  key={preset.name}
                  preset={preset}
                  fieldOptions={SCREENER_FIELD_OPTIONS}
                  onEdit={handleEditPreset}
                  onDelete={handleDeletePreset}
                />
              ))}
            </div>
          )}
        </div>

        {/* Preset Modal */}
        {showPresetModal && (
          <PresetModal
            initialPreset={modalInitialData}
            fieldOptionsMap={fieldOptionsMap}
            onClose={closeModal}
            onSave={handleSavePreset}
          />
        )}
      </Card.Body>
    </Card>
  )
}

// Extracted modal component with internal state management for better performance
const PresetModal = memo(function PresetModal({
  initialPreset,
  fieldOptionsMap,
  onClose,
  onSave,
}: {
  initialPreset: {
    name: string
    logic: 'and' | 'or'
    exchanges: string[]
    filters: DynamicFilter[]
    editingPreset: ScreenerFilterPreset | null
  }
  fieldOptionsMap: Map<string, FilterFieldOption>
  onClose: () => void
  onSave: (preset: {
    name: string
    logic: 'and' | 'or'
    exchanges: string[]
    filters: DynamicFilter[]
    editingPreset: ScreenerFilterPreset | null
  }) => void
}) {
  // Internal state to avoid prop drilling setState functions
  const [presetName, setPresetName] = useState(initialPreset.name)
  const [presetLogic, setPresetLogic] = useState<'and' | 'or'>(initialPreset.logic)
  const [presetExchanges, setPresetExchanges] = useState<string[]>(initialPreset.exchanges)
  const [currentFilters, setCurrentFilters] = useState<DynamicFilter[]>(initialPreset.filters)
  const [showFilterEditor, setShowFilterEditor] = useState(false)
  const [editingFilter, setEditingFilter] = useState<DynamicFilter | null>(null)

  // Deferred filters for smoother rendering when list is long
  const deferredFilters = useDeferredValue(currentFilters)

  // Stable callbacks - all defined once
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPresetName(e.target.value)
  }, [])

  const handleLogicChange = useCallback((logic: 'and' | 'or') => {
    setPresetLogic(logic)
  }, [])

  const toggleExchange = useCallback((exchange: string) => {
    setPresetExchanges(prev =>
      prev.includes(exchange)
        ? prev.filter(e => e !== exchange)
        : [...prev, exchange]
    )
  }, [])

  const handleAddFilter = useCallback(() => {
    setEditingFilter(null)
    setShowFilterEditor(true)
  }, [])

  const handleEditFilter = useCallback((filter: DynamicFilter) => {
    setEditingFilter(filter)
    setShowFilterEditor(true)
  }, [])

  const handleRemoveFilter = useCallback((id: string) => {
    setCurrentFilters(prev => prev.filter(f => f.id !== id))
  }, [])

  const handleSaveFilter = useCallback((filter: DynamicFilter) => {
    setCurrentFilters(prev => {
      if (editingFilter) {
        const result = prev.map(f => f.id === editingFilter.id ? filter : f)
        return result
      }
      return [...prev, filter]
    })
    setShowFilterEditor(false)
    setEditingFilter(null)
  }, [editingFilter])

  const closeFilterEditor = useCallback(() => {
    setShowFilterEditor(false)
    setEditingFilter(null)
  }, [])

  const handleSave = useCallback(() => {
    onSave({
      name: presetName,
      logic: presetLogic,
      exchanges: presetExchanges,
      filters: currentFilters,
      editingPreset: initialPreset.editingPreset,
    })
  }, [presetName, presetLogic, presetExchanges, currentFilters, initialPreset.editingPreset, onSave])

  const handleBackdropClick = useCallback(() => {
    onClose()
  }, [onClose])

  const handleModalClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.4)] w-full max-w-[500px] max-h-[90vh] overflow-auto"
        onClick={handleModalClick}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {initialPreset.editingPreset ? 'Edit Preset' : 'Create Preset'}
          </h3>
          <button
            className="w-8 h-8 flex items-center justify-center bg-transparent border-none rounded text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            onClick={onClose}
            type="button"
          >
            <Icons.X />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Preset Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Preset Name</label>
            <input
              type="text"
              className="px-3 py-2.5 bg-[var(--bg-deep)] border border-[var(--border-dim)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)] focus:ring-[3px] focus:ring-[var(--neon-cyan-dim)]"
              value={presetName}
              onChange={handleNameChange}
              placeholder="e.g., High Momentum Stocks"
              autoFocus
            />
          </div>

          {/* Logic Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Match</span>
            <div className="flex items-center gap-1 p-1 bg-[var(--bg-deep)] border border-[var(--border-dim)] rounded">
              <button
                className={cn(
                  'px-3 py-1 bg-transparent border-none rounded text-xs font-medium cursor-pointer transition-all duration-200',
                  presetLogic === 'and' && 'bg-[var(--neon-cyan)] text-[var(--bg-void)]'
                )}
                onClick={() => handleLogicChange('and')}
                type="button"
              >
                All
              </button>
              <button
                className={cn(
                  'px-3 py-1 bg-transparent border-none rounded text-xs font-medium cursor-pointer transition-all duration-200',
                  presetLogic === 'or' && 'bg-[var(--neon-cyan)] text-[var(--bg-void)]'
                )}
                onClick={() => handleLogicChange('or')}
                type="button"
              >
                Any
              </button>
            </div>
          </div>

          {/* Exchanges */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Exchanges</label>
            <div className="flex gap-2">
              {SCREENER_EXCHANGES.map((exchange) => (
                <button
                  key={exchange}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded transition-all duration-200',
                    'border border-[var(--border-dim)] text-[var(--text-secondary)]',
                    presetExchanges.includes(exchange)
                      ? 'bg-[var(--neon-cyan-dim)] border-[var(--neon-cyan)] text-[var(--neon-cyan)]'
                      : 'bg-[var(--bg-deep)] hover:border-[var(--border-glow)]'
                  )}
                  onClick={() => toggleExchange(exchange)}
                  type="button"
                >
                  {exchange}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Conditions */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Filters</label>
              <button
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--neon-cyan)] bg-transparent border border-dashed border-[var(--neon-cyan-dim)] rounded cursor-pointer hover:bg-[var(--neon-cyan-dim)]"
                onClick={handleAddFilter}
                type="button"
              >
                <Icons.Plus className="w-3 h-3" />
                Add Filter
              </button>
            </div>

            {deferredFilters.length === 0 ? (
              <div className="flex items-center justify-center py-4 text-[var(--text-muted)] text-xs border border-dashed border-[var(--border-dim)] rounded">
                No filters added
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {deferredFilters.map((filter) => (
                  <FilterPill
                    key={filter.id}
                    variant="compact"
                    filter={filter}
                    fieldOption={fieldOptionsMap.get(filter.field)}
                    onEdit={handleEditFilter}
                    onRemove={handleRemoveFilter}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!presetName.trim()}>
            {initialPreset.editingPreset ? 'Update' : 'Create'} Preset
          </Button>
        </div>
      </div>

      {/* Filter Editor Modal */}
      {showFilterEditor && (
        <FilterEditor
          isOpen={showFilterEditor}
          filter={editingFilter}
          fieldOptions={SCREENER_FIELD_OPTIONS}
          operatorOptions={SCREENER_OPERATOR_OPTIONS}
          onSave={handleSaveFilter}
          onClose={closeFilterEditor}
        />
      )}
    </div>
  )
})