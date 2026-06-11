import { useState, useCallback, useMemo, memo } from 'react'
import { Icons } from '../icons/Icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FilterPresetCard } from './FilterPresetCard'
import { EmptyState } from '@/components/ui/empty-state'
import { QueryBuilder } from '../screener/QueryBuilder'
import type { ScreenerFilterPreset } from '@/lib/api'
import { apiNodeToTree, makeBranch, mapTreeToApiFormat } from '@/lib/filterSerialize'
import type { FilterTreeNode } from '@/types'

interface MetricsFilterSectionProps {
  filters: ScreenerFilterPreset[]
  onUpdate: (filters: ScreenerFilterPreset[]) => void
}

const MemoizedFilterPresetCard = memo(FilterPresetCard)

/** A brand-new preset starts empty — the user adds metrics via the picker rather
 *  than inheriting a seeded RS52W condition. */
const newPresetTree = (): FilterTreeNode => makeBranch('and', [])

/**
 * Config-page metrics-filter preset manager (R6). Add / edit both open the SAME
 * shared Query Builder pop-up and read/write the preset's flat filter directly
 * — no flat `filters`/`logic` bridge, no data migration.
 */
export function MetricsFilterSection({ filters, onUpdate }: MetricsFilterSectionProps) {
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<ScreenerFilterPreset | null>(null)

  const handleAddPreset = useCallback(() => {
    setEditingPreset(null)
    setBuilderOpen(true)
  }, [])

  const handleEditPreset = useCallback((preset: ScreenerFilterPreset) => {
    setEditingPreset(preset)
    setBuilderOpen(true)
  }, [])

  const handleDeletePreset = useCallback(
    (name: string) => {
      onUpdate(filters.filter((f) => f.name !== name))
    },
    [filters, onUpdate]
  )

  const closeBuilder = useCallback(() => {
    setBuilderOpen(false)
    setEditingPreset(null)
  }, [])

  const handleBuilderDone = useCallback(
    (root: FilterTreeNode, exchanges: string[], name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const apiFilter = mapTreeToApiFormat(root, exchanges)
      const newPreset: ScreenerFilterPreset = {
        name: trimmed,
        ...apiFilter,
        created_at: editingPreset?.created_at || new Date().toISOString(),
      }

      let updated: ScreenerFilterPreset[]
      if (editingPreset) {
        // Rename-safe: replace the edited preset; if the new name collides with a
        // different preset, overwrite that one too.
        updated = filters
          .filter((f) => f.name === editingPreset.name || f.name !== trimmed)
          .map((f) => (f.name === editingPreset.name ? newPreset : f))
      } else if (filters.some((f) => f.name === trimmed)) {
        updated = filters.map((f) => (f.name === trimmed ? newPreset : f))
      } else {
        updated = [...filters, newPreset]
      }

      onUpdate(updated)
      closeBuilder()
    },
    [editingPreset, filters, onUpdate, closeBuilder]
  )

  // Stable seed while the builder is open (re-derived only when the target preset
  // changes), so QueryBuilder's re-seed effect doesn't clobber in-progress edits.
  const initialRoot = useMemo(
    () => (editingPreset ? apiNodeToTree(editingPreset) : newPresetTree()),
    [editingPreset]
  )
  const initialExchanges = editingPreset?.exchanges ?? []

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
            <EmptyState
              icon="Filter"
              title="No filter presets saved"
              description="Create presets to quickly apply filter combinations."
              className="rounded-lg border-2 border-dashed border-[var(--border-dim)]"
              action={
                <Button variant="secondary" icon="Plus" onClick={handleAddPreset}>
                  <span>Add Preset</span>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {filters.map((preset) => (
                <MemoizedFilterPresetCard
                  key={preset.name}
                  preset={preset}
                  onEdit={handleEditPreset}
                  onDelete={handleDeletePreset}
                />
              ))}
            </div>
          )}
        </div>
      </Card.Body>

      {builderOpen && (
        <QueryBuilder
          initialRoot={initialRoot}
          initialExchanges={initialExchanges}
          title={editingPreset ? `Editing: ★ ${editingPreset.name}` : 'New preset'}
          subtitle={editingPreset ? 'Your saved preset' : 'New saved preset'}
          withName
          initialName={editingPreset?.name ?? ''}
          onDone={handleBuilderDone}
          onCancel={closeBuilder}
        />
      )}
    </Card>
  )
}
