import { memo, useCallback, useMemo, useState } from 'react'
import { Icons } from '../icons/Icons'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { confirm } from '@/components/ui/confirm-dialog'
import { WatchlistRow } from './WatchlistRow'
import { WatchlistConditionDetail } from './WatchlistConditionDetail'
import { WatchlistEditorModal } from './WatchlistEditorModal'
import { watchlistEqual } from '@/lib/watchlistOptions'
import type { ApiWatchlistItem } from '@/lib/api'

interface WatchlistSectionProps {
  items: ApiWatchlistItem[]
  originalItems: ApiWatchlistItem[]
  onUpdate: (items: ApiWatchlistItem[]) => void
}

const detailPanelId = (symbol: string) => `watchlist-detail-${symbol}`

export const WatchlistSection = memo(function WatchlistSection({
  items,
  originalItems,
  onUpdate,
}: WatchlistSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  // Expand-state is component-local ONLY and is never lifted into the items
  // array, so toggling it cannot trip `isDirty` (watchlistEqual is unaffected).
  const [expandSet, setExpandSet] = useState<Set<string>>(() => new Set())

  const isDirty = useMemo(() => !watchlistEqual(items, originalItems), [items, originalItems])

  const conditionTotals = useMemo(() => {
    let active = 0
    let total = 0
    for (const a of items) {
      for (const c of a.conditions) {
        total += 1
        if (c.enabled) active += 1
      }
    }
    return { active, total }
  }, [items])

  const existingSymbols = useMemo(() => items.map((a) => a.symbol), [items])

  // Reconcile-from-props (M4): effectively-expanded = expandSet ∩ live symbols.
  // The incoming `items` prop is the single source of truth for which symbols
  // exist; a stale key (deleted or renamed symbol) is simply never rendered, so
  // delete AND rename self-heal without pruning inside an onUpdate handler.
  const effectivelyExpanded = useMemo(() => {
    const live = new Set<string>()
    for (const a of items) {
      if (expandSet.has(a.symbol)) live.add(a.symbol)
    }
    return live
  }, [expandSet, items])

  const allExpanded = items.length > 0 && effectivelyExpanded.size === items.length

  const handleAdd = useCallback(() => {
    setEditingIndex(null)
    setEditorOpen(true)
  }, [])

  const handleEdit = useCallback((index: number) => {
    setEditingIndex(index)
    setEditorOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (index: number) => {
      const symbol = items[index]?.symbol
      const confirmed = await confirm({
        title: 'Remove from watchlist?',
        message: `This will permanently remove ${symbol} from your watchlist.`,
        confirmText: 'Remove',
        danger: true,
        icon: 'Trash2',
      })
      if (!confirmed) return
      onUpdate(items.filter((_, i) => i !== index))
    },
    [items, onUpdate]
  )

  const handleToggle = useCallback((symbol: string) => {
    setExpandSet((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    setExpandSet(new Set(items.map((a) => a.symbol)))
  }, [items])

  const handleCollapseAll = useCallback(() => {
    setExpandSet(new Set())
  }, [])

  const handleSaveDraft = useCallback(
    (draft: ApiWatchlistItem) => {
      if (editingIndex === null) {
        onUpdate([...items, draft])
      } else {
        onUpdate(items.map((a, i) => (i === editingIndex ? draft : a)))
      }
      setEditorOpen(false)
      setEditingIndex(null)
    },
    [editingIndex, items, onUpdate]
  )

  const handleClose = useCallback(() => {
    setEditorOpen(false)
    setEditingIndex(null)
  }, [])

  const initialDraft = editingIndex !== null ? (items[editingIndex] ?? null) : null

  return (
    <Card className="mb-6">
      <Card.Body>
        <div className="config-section !mb-0">
          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="config-section-title !mb-0 flex items-center gap-2">
              <Icons.Bell />
              <span>Watchlist</span>
              {isDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-[var(--neon-cyan)] shadow-[0_0_8px_var(--neon-cyan)]"
                  title="Unsaved changes"
                  aria-label="Unsaved changes"
                />
              )}
            </h3>
            <Button variant="secondary" size="sm" icon="Plus" onClick={handleAdd}>
              <span>Add Symbol</span>
            </Button>
          </div>

          {/* Subtitle + stats */}
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Get notified on Telegram when price or volume crosses your thresholds.
            {items.length > 0 && (
              <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">
                {items.length} symbol{items.length === 1 ? '' : 's'} &middot;{' '}
                <span
                  className={
                    conditionTotals.active === 0
                      ? 'text-[var(--neon-amber)]'
                      : 'text-[var(--neon-cyan)]'
                  }
                >
                  {conditionTotals.active}/{conditionTotals.total} conditions active
                </span>
              </span>
            )}
          </p>

          {/* Watchlist or empty state */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-[var(--border-dim)] rounded-lg gap-3">
              <Icons.Bell className="w-10 h-10 opacity-30 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm text-[var(--text-muted)] mb-0.5">Your watchlist is empty</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Add price or volume triggers for your watched symbols
                </p>
              </div>
              <Button variant="secondary" size="sm" icon="Plus" onClick={handleAdd}>
                <span>Add your first symbol</span>
              </Button>
            </div>
          ) : (
            <>
              {/* Expand-all / Collapse-all controls (hidden on empty state) */}
              <div className="flex items-center justify-end gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={handleExpandAll} disabled={allExpanded}>
                  <span>Expand all</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCollapseAll}
                  disabled={effectivelyExpanded.size === 0}
                >
                  <span>Collapse all</span>
                </Button>
              </div>

              {/* Column header — aligned to the row tracks */}
              <div className="watchlist-row-grid px-3 py-1.5 text-[11px] uppercase tracking-wider text-left font-medium text-[var(--text-muted)]">
                <span aria-hidden="true" />
                <span>Symbol</span>
                <span>Status</span>
                <span>Watching</span>
                <span>On/Total</span>
                <span className="justify-self-end">Actions</span>
              </div>

              <div className="flex flex-col gap-2">
                {items.map((item, idx) => {
                  const expanded = effectivelyExpanded.has(item.symbol)
                  const panelId = detailPanelId(item.symbol)
                  return (
                    <div
                      key={item.symbol}
                      className="rounded-md border border-[var(--border-dim)] overflow-hidden bg-[var(--bg-surface)] transition-colors duration-150 hover:border-[var(--border-glow)]"
                    >
                      <WatchlistRow
                        item={item}
                        index={idx}
                        expanded={expanded}
                        panelId={panelId}
                        onToggle={handleToggle}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                      {expanded && (
                        <WatchlistConditionDetail
                          item={item}
                          index={idx}
                          panelId={panelId}
                          onEdit={handleEdit}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Editor modal — rendered via Radix Dialog portal */}
        {editorOpen && (
          <WatchlistEditorModal
            initial={initialDraft}
            existingSymbols={existingSymbols}
            onSave={handleSaveDraft}
            onClose={handleClose}
          />
        )}
      </Card.Body>
    </Card>
  )
})
