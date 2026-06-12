import { memo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { FilterField, FilterOperator, FilterTreeNode } from '@/types'
import { MAX_FILTER_CONDITIONS, MAX_FILTER_DEPTH } from '@/types'
import {
  SCREENER_FIELD_OPTIONS,
  VALID_FILTER_OPERATORS,
  isFloatField,
  isPriceOrMA,
} from '@/lib/screenerFilterOptions'
import { fieldType, isLeaf } from '@/lib/filterSerialize'
import { type GroupRef } from '@/lib/filterTreeOps'
import {
  CATEGORY_COLOR,
  CATEGORY_ORDER,
  depthBandColor,
  type FilterCategory,
} from './filterBuilderTheme'

/** Field option lookup, built once at module scope. */
const FIELD_OPTION = new Map(SCREENER_FIELD_OPTIONS.map((o) => [o.value, o]))

/** The builder shows current_price as the short "Price" (formula text keeps "Last Price"). */
const builderLabel = (value: string, label: string): string =>
  value === 'current_price' ? 'Price' : label

/**
 * Field <optgroup>/<option> tree, built ONCE at module scope. It's identical for
 * every condition row and never changes, so sharing the same element references
 * lets React skip reconciling the (large) option list on every keystroke — the
 * dominant cost of the Query Builder pop-up before this fix.
 */
const FIELD_OPTGROUPS = CATEGORY_ORDER.map((cat) => (
  <optgroup key={cat} label={cat}>
    {SCREENER_FIELD_OPTIONS.filter((o) => o.category === cat).map((o) => (
      <option key={o.value} value={o.value}>
        {builderLabel(o.value, o.label)}
      </option>
    ))}
  </optgroup>
))

// Ordering operators ('=' excluded), built once at module scope. Used by
// INTEGER rows (RS ranks, share volumes), where exact boundaries are real so
// >= / <= are meaningful. '=' is a footgun for these too and is never offered;
// signals are the sole '=' users and render a static marker, not this dropdown.
const ORDERING_OP_OPTIONS = VALID_FILTER_OPERATORS.filter((op) => op !== '=').map((op) => (
  <option key={op} value={op}>
    {op}
  </option>
))

// Strict inequalities only ('>' / '<'). Used by FLOAT rows (price, % change,
// vol×SMA, the EMA/SMA moving averages) and every field-vs-field price/MA
// comparison — a float never lands exactly on a threshold, so >= / <= add nothing.
const STRICT_OP_OPTIONS = VALID_FILTER_OPERATORS.filter((op) => op === '>' || op === '<').map(
  (op) => (
    <option key={op} value={op}>
      {op}
    </option>
  )
)

/** Price/MA fields selectable as the right-hand side of a comparison ("compare to"). */
const RHS_FIELD_OPTIONS = SCREENER_FIELD_OPTIONS.filter((o) => isPriceOrMA(o.value)).map((o) => ({
  value: o.value,
  label: builderLabel(o.value, o.label),
}))

export interface FilterGroupCallbacks {
  setLogic: (groupId: string, logic: 'and' | 'or') => void
  toggleNegate: (groupId: string) => void
  removeNode: (id: string) => void
  setField: (leafId: string, field: FilterField) => void
  setOp: (leafId: string, op: FilterOperator) => void
  setValue: (leafId: string, value: number | boolean) => void
  /** Set/clear a leaf's RHS comparison field (field-vs-field); undefined clears it. */
  setRhsField: (leafId: string, rhsField: FilterField | undefined) => void
  openMetricPicker: (groupId: string) => void
  addGroup: (groupId: string) => void
  moveCond: (leafId: string, targetGroupId: string) => void
  /** Reorder: drop the dragged leaf immediately before `beforeId` (same group or across). */
  moveCondBefore: (dragId: string, beforeId: string) => void
}

interface FilterGroupProps {
  node: FilterTreeNode
  depth: number
  isRoot: boolean
  /** Total leaf count across the whole tree — drives the global 50-leaf cap. */
  totalLeaves: number
  /** Flat list of all groups (for the "Move to group…" menu). Referentially
   *  stable across value-only edits so memoized rows don't churn. */
  allGroups: GroupRef[]
  /** id of the leaf currently being dragged, or null. */
  dragId: string | null
  setDragId: (id: string | null) => void
  cb: FilterGroupCallbacks
}

/**
 * Recursive branch component (S6). Renders one group: header (AND/OR segmented +
 * ⊘ NOT + remove), inline-editable condition rows, and footer (+Add metrics /
 * +Group). Carries `data-depth` (deterministic for tests) and a per-depth color
 * band. Conditions are drop targets' children; the group itself is the drop
 * target. Ported from the prototype renderGroup / inlineRow.
 */
export function FilterGroup({
  node,
  depth,
  isRoot,
  totalLeaves,
  allGroups,
  dragId,
  setDragId,
  cb,
}: FilterGroupProps) {
  const [isDropTarget, setIsDropTarget] = useState(false)
  const children = node.children ?? []
  const atDepthCap = depth >= MAX_FILTER_DEPTH
  const atLeafCap = totalLeaves >= MAX_FILTER_CONDITIONS

  const handleDragOver = (e: React.DragEvent) => {
    if (!dragId) return
    e.preventDefault()
    e.stopPropagation()
    setIsDropTarget(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when the pointer truly leaves this element (not a child).
    if (e.currentTarget === e.target) setIsDropTarget(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDropTarget(false)
    if (dragId) {
      cb.moveCond(dragId, node.id)
      setDragId(null)
    }
  }

  return (
    <div
      className={cn(
        'relative my-2 rounded-xl border bg-[var(--bg-deep)] py-3 pl-4 pr-3',
        node.negate ? 'border-[var(--neon-bear)]' : 'border-[var(--border-dim)]',
        isDropTarget &&
          'outline outline-2 outline-dashed outline-[var(--neon-cyan)] outline-offset-[3px]'
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: depthBandColor(depth) }}
      data-depth={depth}
      data-testid="filter-group"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {node.negate && (
        <span className="absolute -top-2.5 left-3.5 rounded border border-[var(--neon-bear)] bg-[var(--bg-void)] px-1.5 py-px text-[10px] font-bold tracking-[0.06em] text-[var(--neon-bear)]">
          NOT
        </span>
      )}

      {/* Header */}
      <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Combine</span>
        <Segmented logic={node.logic ?? 'and'} onChange={(logic) => cb.setLogic(node.id, logic)} />
        <button
          type="button"
          onClick={() => cb.toggleNegate(node.id)}
          aria-pressed={node.negate === true}
          className={cn(
            'rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide',
            node.negate
              ? 'border-[var(--neon-bear)] bg-[var(--neon-bear-dim)] text-[var(--neon-bear)]'
              : 'border-[var(--border-glow)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          ⊘ NOT
        </button>
        <div className="flex-1" />
        {!isRoot && (
          <button
            type="button"
            onClick={() => cb.removeNode(node.id)}
            aria-label="Remove group"
            className="grid h-7 w-7 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--neon-bear-dim)] hover:text-[var(--neon-bear)]"
          >
            🗑
          </button>
        )}
      </div>

      {/* Children */}
      <div className="my-1.5 flex flex-col gap-[7px]">
        {children.map((ch) =>
          isLeaf(ch) ? (
            <ConditionRow
              key={ch.id}
              leaf={ch}
              allGroups={allGroups}
              dragId={dragId}
              setDragId={setDragId}
              currentGroupId={node.id}
              cb={cb}
            />
          ) : (
            <FilterGroup
              key={ch.id}
              node={ch}
              depth={depth + 1}
              isRoot={false}
              totalLeaves={totalLeaves}
              allGroups={allGroups}
              dragId={dragId}
              setDragId={setDragId}
              cb={cb}
            />
          )
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={atLeafCap}
          onClick={() => cb.openMetricPicker(node.id)}
          data-testid="add-metrics"
          className={cn(
            'rounded-lg border px-2.5 py-1 text-xs font-medium',
            'border-[var(--neon-cyan)] bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]',
            atLeafCap && 'cursor-not-allowed border-dashed opacity-40'
          )}
        >
          + Add metrics
        </button>
        <button
          type="button"
          disabled={atDepthCap}
          onClick={() => cb.addGroup(node.id)}
          data-testid="add-group"
          className={cn(
            'rounded-lg border border-dashed border-[var(--border-glow)] bg-transparent px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--neon-cyan)]',
            atDepthCap && 'cursor-not-allowed opacity-40'
          )}
        >
          + Group
        </button>
        {atDepthCap ? (
          <span
            className="text-[11px] italic text-[var(--text-muted)]"
            data-testid="cap-hint-depth"
          >
            · max depth ({MAX_FILTER_DEPTH})
          </span>
        ) : (
          atLeafCap && (
            <span
              className="text-[11px] italic text-[var(--text-muted)]"
              data-testid="cap-hint-leaves"
            >
              · max {MAX_FILTER_CONDITIONS} conditions
            </span>
          )
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* AND / OR segmented toggle                                           */
/* ------------------------------------------------------------------ */

function Segmented({
  logic,
  onChange,
}: {
  logic: 'and' | 'or'
  onChange: (l: 'and' | 'or') => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[var(--border-dim)] bg-[var(--bg-deep)]">
      <button
        type="button"
        onClick={() => onChange('and')}
        className={cn(
          'px-3.5 py-1 text-xs font-bold tracking-wide',
          logic === 'and'
            ? 'bg-[var(--neon-bull)] text-[var(--bg-void)]'
            : 'text-[var(--text-muted)]'
        )}
      >
        AND
      </button>
      <button
        type="button"
        onClick={() => onChange('or')}
        className={cn(
          'px-3.5 py-1 text-xs font-bold tracking-wide',
          logic === 'or'
            ? 'bg-[var(--neon-cyan)] text-[var(--bg-void)]'
            : 'text-[var(--text-muted)]'
        )}
      >
        OR
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Inline-editable condition row                                       */
/* ------------------------------------------------------------------ */

const ConditionRow = memo(function ConditionRow({
  leaf,
  allGroups,
  dragId,
  setDragId,
  currentGroupId,
  cb,
}: {
  leaf: FilterTreeNode
  allGroups: GroupRef[]
  dragId: string | null
  setDragId: (id: string | null) => void
  currentGroupId: string
  cb: FilterGroupCallbacks
}) {
  const cond = leaf.condition!
  const opt = FIELD_OPTION.get(cond.field)
  const cat = (opt?.category ?? 'RS Rating') as FilterCategory
  const [menuOpen, setMenuOpen] = useState(false)
  // True while another condition is dragged over THIS row's top edge → shows an
  // "insert here" indicator and, on drop, reorders the dragged leaf before this one.
  const [dropBefore, setDropBefore] = useState(false)

  const moveTargets = allGroups.filter((g) => g.id !== currentGroupId)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-elevated)] px-2 py-1.5',
        dragId === leaf.id && 'border-[var(--neon-cyan)] opacity-40',
        dropBefore && 'border-t-2 border-t-[var(--neon-cyan)]'
      )}
      draggable
      data-testid="condition-row"
      data-leaf-id={leaf.id}
      data-field={cond.field}
      onDragStart={(e) => {
        setDragId(leaf.id)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', leaf.id)
      }}
      onDragEnd={() => {
        setDragId(null)
        setDropBefore(false)
      }}
      onDragOver={(e) => {
        // Reorder target: only when dragging a DIFFERENT condition. Stop bubbling
        // so the enclosing group's "append" drop handler does not also fire.
        if (!dragId || dragId === leaf.id) return
        e.preventDefault()
        e.stopPropagation()
        setDropBefore(true)
      }}
      onDragLeave={() => setDropBefore(false)}
      onDrop={(e) => {
        if (!dragId || dragId === leaf.id) {
          setDropBefore(false)
          return
        }
        e.preventDefault()
        e.stopPropagation()
        cb.moveCondBefore(dragId, leaf.id)
        setDragId(null)
        setDropBefore(false)
      }}
    >
      <span
        className="cursor-grab select-none px-0.5 text-sm text-[var(--text-muted)] active:cursor-grabbing"
        title="Drag to reorder, or onto another group"
        aria-hidden="true"
      >
        ⠿
      </span>
      <span
        className="inline-block h-[9px] w-[9px] flex-none rounded-full"
        style={{ background: CATEGORY_COLOR[cat] }}
      />

      <FieldSelect leaf={leaf} cb={cb} />
      <OpControl leaf={leaf} cb={cb} />
      {cond.rhsField != null || isPriceOrMA(cond.field) ? (
        // Price/MA row: a single "compare to" control (a value… | another price/MA field).
        <CompareToControl leaf={leaf} cb={cb} />
      ) : (
        // Numeric (RS/volume) or signal row: a plain value input / Yes-No.
        <ValueControl leaf={leaf} cb={cb} />
      )}

      <div className="flex-1" />

      {/* Non-DnD "Move to group…" menu (a11y / touch path, M5) */}
      {moveTargets.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Move to group"
            data-testid="move-menu-trigger"
            className="grid h-7 w-7 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            ⇄
          </button>
          {menuOpen && (
            <div
              role="menu"
              data-testid="move-menu"
              className="absolute right-0 top-8 z-10 min-w-[160px] rounded-lg border border-[var(--border-glow)] bg-[var(--bg-surface)] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
            >
              {moveTargets.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="menuitem"
                  data-testid="move-menu-item"
                  data-target-group={g.id}
                  onClick={() => {
                    cb.moveCond(leaf.id, g.id)
                    setMenuOpen(false)
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                >
                  {g.depth === 1 ? 'Top-level group' : `Group · level ${g.depth}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => cb.removeNode(leaf.id)}
        aria-label="Remove condition"
        className="grid h-7 w-7 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--neon-bear-dim)] hover:text-[var(--neon-bear)]"
      >
        ✕
      </button>
    </div>
  )
})

/* ------------------------------------------------------------------ */
/* Field / operator / value controls                                   */
/* ------------------------------------------------------------------ */

const selectClass =
  'rounded-md border border-[var(--border-dim)] bg-[var(--bg-elevated)] px-2 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--neon-cyan)] focus:outline-none'

function FieldSelect({ leaf, cb }: { leaf: FilterTreeNode; cb: FilterGroupCallbacks }) {
  const cond = leaf.condition!
  return (
    <select
      className={selectClass}
      value={cond.field}
      aria-label="Metric"
      onChange={(e) => cb.setField(leaf.id, e.target.value as FilterField)}
    >
      {FIELD_OPTGROUPS}
    </select>
  )
}

function OpControl({ leaf, cb }: { leaf: FilterTreeNode; cb: FilterGroupCallbacks }) {
  const cond = leaf.condition!
  // Signals are "=" only (the grammar invariant); render a static marker.
  if (fieldType(cond.field) === 'sig') {
    return <span className="font-semibold text-[var(--neon-cyan)]">=</span>
  }
  // Float rows (a float field's value, or any field-vs-field price/MA comparison)
  // allow strict >/< only; integer rows (RS, volume) allow >, >=, <, <=.
  const options =
    cond.rhsField != null || isFloatField(cond.field) ? STRICT_OP_OPTIONS : ORDERING_OP_OPTIONS
  return (
    <select
      className={cn(selectClass, 'min-w-[56px]')}
      value={cond.op}
      aria-label="Operator"
      onChange={(e) => cb.setOp(leaf.id, e.target.value as FilterOperator)}
    >
      {options}
    </select>
  )
}

/** Sentinel for the "a value…" option in the compare-to dropdown. */
const COMPARE_TO_VALUE = '__value__'

/**
 * Unified "compare to" control for a Price/MA condition. A single dropdown picks
 * the right-hand side: "a value…" (a number, only when the LHS is Price) or
 * another price/MA metric (field-vs-field). In value mode a number input renders
 * beside it. The LHS field itself is excluded from the metric options.
 */
function CompareToControl({ leaf, cb }: { leaf: FilterTreeNode; cb: FilterGroupCallbacks }) {
  const cond = leaf.condition!
  const lhsIsPrice = cond.field === 'current_price'
  const valueMode = cond.rhsField == null // only reachable for a current_price LHS
  return (
    <>
      <select
        className={cn(selectClass, 'min-w-[120px]')}
        value={cond.rhsField ?? COMPARE_TO_VALUE}
        aria-label="Compare to"
        data-testid="compare-to"
        onChange={(e) => {
          const v = e.target.value
          cb.setRhsField(leaf.id, v === COMPARE_TO_VALUE ? undefined : (v as FilterField))
        }}
      >
        {lhsIsPrice && <option value={COMPARE_TO_VALUE}>a value…</option>}
        {RHS_FIELD_OPTIONS.filter((o) => o.value !== cond.field).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {valueMode && lhsIsPrice && (
        <input
          type="number"
          step="any"
          className={cn(selectClass, 'w-24 font-mono')}
          value={typeof cond.value === 'number' ? cond.value : ''}
          aria-label="Value"
          data-testid="compare-value"
          onChange={(e) => {
            const raw = e.target.value
            const parsed = parseFloat(raw)
            cb.setValue(leaf.id, raw === '' || Number.isNaN(parsed) ? 0 : parsed)
          }}
        />
      )}
    </>
  )
}

function ValueControl({ leaf, cb }: { leaf: FilterTreeNode; cb: FilterGroupCallbacks }) {
  const cond = leaf.condition!
  const t = fieldType(cond.field)
  if (t === 'sig') {
    return (
      <select
        className={selectClass}
        value={cond.value === true ? 'true' : 'false'}
        aria-label="Value"
        onChange={(e) => cb.setValue(leaf.id, e.target.value === 'true')}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }
  return (
    <input
      type="number"
      step="any"
      className={cn(selectClass, 'w-24 font-mono')}
      value={typeof cond.value === 'number' ? cond.value : ''}
      aria-label="Value"
      onChange={(e) => {
        const raw = e.target.value
        const parsed = parseFloat(raw)
        cb.setValue(leaf.id, raw === '' || Number.isNaN(parsed) ? 0 : parsed)
      }}
    />
  )
}
