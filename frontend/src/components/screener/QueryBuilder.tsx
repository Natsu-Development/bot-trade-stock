import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { FilterField, FilterTreeNode } from '@/types'
import { FilterFormula } from './FilterFormula'
import { SCREENER_EXCHANGES } from '@/lib/screenerFilterOptions'
import {
  addGroup,
  addLeavesToGroup,
  countLeaves,
  findById,
  listGroups,
  moveCond,
  moveCondBefore,
  remainingCapacity,
  removeNode,
  setLeafField,
  setLeafRhsField,
  updateNode,
} from '@/lib/filterTreeOps'
import { FilterGroup, type FilterGroupCallbacks } from './FilterGroup'
import { MetricPicker } from './MetricPicker'

interface QueryBuilderProps {
  /** Initial tree the builder opens with (the canonical tree from the parent). */
  initialRoot: FilterTreeNode
  /** Initial selected exchanges. */
  initialExchanges?: string[]
  /** Modal title (e.g. "Editing: ★ <name>" or "New filter"). */
  title?: string
  /** Provenance subline shown under the title (e.g. "Your saved preset"). */
  subtitle?: string
  /** Whether to render the exchange chip row (screener: yes; preset: optional). */
  showExchanges?: boolean
  /** Optional preset-name field (R6 config editor). When set, a name input renders
   *  and Done is disabled until non-empty; the trimmed name is passed to onDone. */
  withName?: boolean
  /** Initial preset name (when `withName`). */
  initialName?: string
  /** Apply + close. Receives the edited tree, exchanges, and trimmed name. */
  onDone: (root: FilterTreeNode, exchanges: string[], name: string) => void
  /** Discard + close (Cancel / backdrop). */
  onCancel: () => void
  /** Optional: save the current tree as a named preset WITHOUT closing the
   *  builder (screener "Save as preset"). When omitted, no save UI renders. */
  onSavePreset?: (root: FilterTreeNode, exchanges: string[], name: string) => void
}

/**
 * Query Builder POP-UP modal (S6) — a MODAL over a dimmed page, NOT a separate
 * view. The page stays mounted behind a backdrop. Edits a working copy of the
 * tree; "✓ Done · view results" commits via onDone, "Cancel"/backdrop discards.
 * Shared by the screener ("⚙ Open builder") and the Config preset editor (R6).
 * Ported from the prototype builder-view shell + renderBuilder + renderPreview.
 */
export function QueryBuilder({
  initialRoot,
  initialExchanges = [],
  title = 'Query Builder',
  subtitle,
  showExchanges = true,
  withName = false,
  initialName = '',
  onDone,
  onCancel,
  onSavePreset,
}: QueryBuilderProps) {
  // Every price/MA leaf is already explicit field-vs-field (the parser, addLeaves,
  // and setLeafField all emit current_price-vs-MA), so the seed needs no normalization.
  const [root, setRoot] = useState<FilterTreeNode>(initialRoot)
  const [exchanges, setExchanges] = useState<string[]>(initialExchanges)
  const [name, setName] = useState<string>(initialName)
  const [dragId, setDragId] = useState<string | null>(null)
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null)
  // null = save form closed; '' or a string = the inline "Save as preset" form
  // is open with that draft name (screener invocation only).
  const [saveName, setSaveName] = useState<string | null>(null)

  // Re-seed when the builder is (re)opened on a different preset.
  useEffect(() => {
    setRoot(initialRoot)
    setExchanges(initialExchanges)
    setName(initialName)
    setSaveName(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoot])

  // Escape cancels the builder (but not while the metric picker or the inline
  // save form is open — those own Escape first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pickerGroupId && saveName === null) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, pickerGroupId, saveName])

  const totalLeaves = countLeaves(root)
  // Referentially-stable group list: a NEW array only when the SET of groups
  // (ids/depths) actually changes. Value-only edits keep the same reference so
  // memoized ConditionRows don't re-render across the tree. Keyed by structure
  // (not `root`) and kept pure — no render-time ref mutation.
  const groups = listGroups(root)
  const groupKey = groups.map((g) => `${g.id}:${g.depth}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allGroups = useMemo(() => groups, [groupKey])

  // The mutation callbacks are referentially STABLE — they close over only the
  // stable setRoot/setPickerGroupId setters and module-level helpers. Keeping
  // `cb` stable lets memoized ConditionRows re-render only when their own leaf
  // changes, not on every edit elsewhere in the tree (the pop-up perf fix).
  const cb: FilterGroupCallbacks = useMemo(
    () => ({
      setLogic: (id, logic) => setRoot((r) => updateNode(r, id, { logic })),
      toggleNegate: (id) =>
        setRoot((r) => {
          const current = id === r.id ? r : findById(r, id)
          return updateNode(r, id, { negate: !(current?.negate === true) })
        }),
      removeNode: (id) => setRoot((r) => removeNode(r, id)),
      setField: (leafId, field) => setRoot((r) => setLeafField(r, leafId, field)),
      setOp: (leafId, op) => setRoot((r) => updateNode(r, leafId, { condition: { op } })),
      setValue: (leafId, value) => setRoot((r) => updateNode(r, leafId, { condition: { value } })),
      setRhsField: (leafId, rhsField) => setRoot((r) => setLeafRhsField(r, leafId, rhsField)),
      openMetricPicker: (id) => setPickerGroupId(id),
      addGroup: (id) => setRoot((r) => addGroup(r, id)),
      moveCond: (leafId, targetGroupId) => setRoot((r) => moveCond(r, leafId, targetGroupId)),
      moveCondBefore: (dragId, beforeId) => setRoot((r) => moveCondBefore(r, dragId, beforeId)),
    }),
    []
  )

  const handleAddMetrics = (fields: FilterField[]) => {
    if (!pickerGroupId) return
    setRoot((r) => addLeavesToGroup(r, pickerGroupId, fields).tree)
    setPickerGroupId(null)
  }

  const toggleExchange = (e: string) =>
    setExchanges((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))

  const handleBackdrop = (ev: React.MouseEvent) => {
    if (ev.target === ev.currentTarget) onCancel()
  }

  // Save the current tree as a named preset (inline form) without closing the
  // builder — so the user can keep editing / then "Done · view results".
  const commitSave = () => {
    const n = (saveName ?? '').trim()
    if (!n) return
    onSavePreset?.(root, exchanges, n)
    setSaveName(null)
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-[5vh]"
      onClick={handleBackdrop}
      data-testid="query-builder-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-[940px] max-w-[94vw] max-h-[88vh] overflow-y-auto rounded-2xl border border-[var(--border-glow)] bg-[var(--bg-surface)] px-5 pb-6 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        {/* Sticky bar */}
        <div className="sticky top-0 z-[3] mb-4 flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-dim)] bg-[var(--bg-surface)] py-3.5">
          <div className="flex min-w-0 flex-col">
            <h2
              className="truncate text-base font-semibold text-[var(--text-primary)]"
              data-testid="builder-title"
            >
              {title}
            </h2>
            {subtitle && (
              <span className="text-[12px] text-[var(--text-muted)]" data-testid="builder-subtitle">
                {subtitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              title="Close without applying"
              data-testid="builder-cancel"
              className="rounded-lg border border-[var(--border-glow)] bg-[var(--bg-elevated)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
            {onSavePreset && (
              <button
                type="button"
                onClick={() => setSaveName((v) => (v === null ? '' : null))}
                aria-expanded={saveName !== null}
                title="Save this query as a reusable preset"
                data-testid="builder-save-preset"
                className="rounded-lg border border-[var(--neon-cyan)] bg-[var(--neon-cyan-dim)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--neon-cyan)] hover:brightness-110"
              >
                💾 Save as preset
              </button>
            )}
            <button
              type="button"
              onClick={() => onDone(root, exchanges, name.trim())}
              disabled={withName && name.trim().length === 0}
              data-testid="builder-done"
              className={cn(
                'rounded-lg border border-[var(--neon-bull)] bg-[var(--neon-bull-dim)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--neon-bull)] hover:brightness-110',
                withName && name.trim().length === 0 && 'cursor-not-allowed opacity-40'
              )}
            >
              {withName ? '✓ Save preset' : '✓ Done · view results'}
            </button>
          </div>
        </div>

        {/* Inline "Save as preset" form (screener invocation) */}
        {onSavePreset && saveName !== null && (
          <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="builder-save-row">
            <input
              type="text"
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitSave()
                }
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setSaveName(null)
                }
              }}
              placeholder="Preset name, e.g. High Momentum"
              data-testid="builder-save-name"
              className="min-w-[220px] flex-1 rounded border border-[var(--border-dim)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--neon-cyan)] focus:outline-none focus:ring-[3px] focus:ring-[var(--neon-cyan-dim)]"
            />
            <button
              type="button"
              onClick={commitSave}
              disabled={saveName.trim().length === 0}
              data-testid="builder-save-confirm"
              className={cn(
                'rounded-lg border border-[var(--neon-bull)] bg-[var(--neon-bull-dim)] px-3.5 py-2 text-[13px] font-medium text-[var(--neon-bull)] hover:brightness-110',
                saveName.trim().length === 0 && 'cursor-not-allowed opacity-40'
              )}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setSaveName(null)}
              className="rounded-lg border border-[var(--border-glow)] bg-[var(--bg-elevated)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Preset name (R6 config editor) */}
        {withName && (
          <div className="mb-3 flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Preset Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., High Momentum Stocks"
              data-testid="builder-preset-name"
              autoFocus
              className="rounded border border-[var(--border-dim)] bg-[var(--bg-deep)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--neon-cyan)] focus:outline-none focus:ring-[3px] focus:ring-[var(--neon-cyan-dim)]"
            />
          </div>
        )}

        {/* Tree */}
        <FilterGroup
          node={root}
          depth={1}
          isRoot
          totalLeaves={totalLeaves}
          allGroups={allGroups}
          dragId={dragId}
          setDragId={setDragId}
          cb={cb}
        />

        {/* Exchanges (outer AND, never part of the boolean query) */}
        {showExchanges && (
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[var(--text-muted)]">Exchanges (outer AND):</span>
            {SCREENER_EXCHANGES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggleExchange(e)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium',
                  exchanges.includes(e)
                    ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]'
                    : 'border-[var(--border-glow)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                )}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Live preview = FilterFormula(root) — same renderer/format as the
            screener formula box and the config preset card (one layout source). */}
        <div
          className="mt-4 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-deep)] px-3.5 py-3"
          style={{ borderLeft: '3px solid var(--neon-bull)' }}
        >
          <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            Live preview · this is the formula shown on the screener
          </div>
          <div data-testid="builder-preview">
            <FilterFormula root={root} className="text-[13px]" />
          </div>
        </div>
      </div>

      {pickerGroupId && (
        <MetricPicker
          remaining={remainingCapacity(root)}
          onDone={handleAddMetrics}
          onClose={() => setPickerGroupId(null)}
        />
      )}
    </div>
  )
}
