import type { FilterField, FilterOperator, FilterTreeNode } from '@/types'
import { MAX_FILTER_CONDITIONS } from '@/types'
import { fieldType, isLeaf, makeLeaf, uid } from './filterSerialize'
import { isFloatField, isPriceOrMA } from './screenerFilterOptions'

/* ------------------------------------------------------------------ */
/* Pure tree-mutation helpers for the Query Builder (S6).              */
/* Ported from the prototype's countConds / findById / findParentOf /  */
/* moveCond / removeNode / defaultsFor + the M2 bulk-add cap clamp.    */
/* These are pure (no React, no DOM) so they unit-test cleanly.        */
/* ------------------------------------------------------------------ */

/** Count of leaf conditions across the whole tree (global cap basis). */
export function countLeaves(node: FilterTreeNode): number {
  if (isLeaf(node)) return 1
  return (node.children ?? []).reduce((sum, ch) => sum + countLeaves(ch), 0)
}

/** Find a node by its client id anywhere in the tree (depth-first). */
export function findById(root: FilterTreeNode, id: string): FilterTreeNode | null {
  for (const ch of root.children ?? []) {
    if (ch.id === id) return ch
    if (!isLeaf(ch)) {
      const found = findById(ch, id)
      if (found) return found
    }
  }
  return null
}

/** Find the branch that directly contains the node with the given id. */
export function findParentOf(root: FilterTreeNode, id: string): FilterTreeNode | null {
  for (const ch of root.children ?? []) {
    if (ch.id === id) return root
    if (!isLeaf(ch)) {
      const parent = findParentOf(ch, id)
      if (parent) return parent
    }
  }
  return null
}

/** Default op/value for a freshly added field (ported from prototype `defaultsFor`). */
export function defaultsFor(field: FilterField): { op: FilterOperator; value: number | boolean } {
  const t = fieldType(field)
  if (t === 'sig') return { op: '=', value: true }
  // MA comparisons and float numerics use strict '>'; integer numerics keep '>='.
  if (t === 'ma') return { op: '>', value: 0 }
  return { op: isFloatField(field) ? '>' : '>=', value: DEFAULT_NUMERIC_VALUE[field] ?? 0 }
}

/** Per-field default numeric values mirroring the prototype DEFVAL map. */
const DEFAULT_NUMERIC_VALUE: Partial<Record<FilterField, number>> = {
  rs_1m: 70,
  rs_3m: 70,
  rs_6m: 70,
  rs_9m: 70,
  rs_52w: 70,
  volume_vs_sma: 1.5,
  current_volume: 1_000_000,
  volume_sma20: 1_000_000,
  current_price: 20,
  price_change_pct: 0,
}

/**
 * Remaining number of leaves that may be added before hitting the global cap,
 * given the current tree. Never negative. Used by the metric picker to clamp
 * selectable count to `MAX_FILTER_CONDITIONS − currentLeafCount` (M2).
 */
export function remainingCapacity(root: FilterTreeNode): number {
  return Math.max(0, MAX_FILTER_CONDITIONS - countLeaves(root))
}

/**
 * Immutably relocate a condition (leaf) identified by `id` into `targetId`'s
 * group. Returns a NEW tree. No-op (returns the same root reference) when the
 * node is missing, is not a leaf, the target is missing/not a branch, or the
 * node already lives directly in the target. Conditions only — whole groups are
 * never moved (mirrors the prototype `moveCond`).
 */
export function moveCond(root: FilterTreeNode, id: string, targetId: string): FilterTreeNode {
  const node = findById(root, id)
  const parent = findParentOf(root, id)
  if (!node || !isLeaf(node) || !parent) return root
  if (parent.id === targetId) return root
  const target = root.id === targetId ? root : findById(root, targetId)
  if (!target || isLeaf(target)) return root

  function rebuild(branch: FilterTreeNode): FilterTreeNode {
    let children = (branch.children ?? []).filter((ch) => ch.id !== id)
    children = children.map((ch) => (isLeaf(ch) ? ch : rebuild(ch)))
    if (branch.id === targetId) {
      children = [...children, node!]
    }
    return { ...branch, children }
  }
  return rebuild(root)
}

/**
 * Immutably move a condition (leaf) `dragId` to sit immediately BEFORE `beforeId`
 * within beforeId's parent group. Handles BOTH same-group reorder AND positioned
 * cross-group insert. Returns a NEW tree, or the same `root` reference on a no-op
 * (dragId === beforeId, dragId missing / not a leaf, or beforeId not found).
 */
export function moveCondBefore(
  root: FilterTreeNode,
  dragId: string,
  beforeId: string
): FilterTreeNode {
  if (dragId === beforeId) return root
  const node = findById(root, dragId)
  const beforeParent = findParentOf(root, beforeId)
  if (!node || !isLeaf(node) || !beforeParent) return root

  function rebuild(branch: FilterTreeNode): FilterTreeNode {
    // Drop the dragged leaf wherever it currently lives…
    let children = (branch.children ?? []).filter((ch) => ch.id !== dragId)
    children = children.map((ch) => (isLeaf(ch) ? ch : rebuild(ch)))
    // …and re-insert it immediately before the anchor in the anchor's parent.
    if (branch.id === beforeParent!.id) {
      const idx = children.findIndex((ch) => ch.id === beforeId)
      if (idx >= 0) children = [...children.slice(0, idx), node!, ...children.slice(idx)]
    }
    return { ...branch, children }
  }
  return rebuild(root)
}

/**
 * Immutably remove a node (leaf or branch) by id, returning a NEW tree. The
 * root itself is never removed.
 */
export function removeNode(root: FilterTreeNode, id: string): FilterTreeNode {
  function rebuild(branch: FilterTreeNode): FilterTreeNode {
    const children = (branch.children ?? [])
      .filter((ch) => ch.id !== id)
      .map((ch) => (isLeaf(ch) ? ch : rebuild(ch)))
    return { ...branch, children }
  }
  return rebuild(root)
}

/**
 * Immutably push new leaves for `fields` into the group `targetId`, returning a
 * NEW tree. The number of leaves actually added is CLAMPED to the remaining
 * global capacity (M2) — selecting N fields at 48 leaves adds only 2. Returns
 * `{ tree, added }` so callers can surface the clamped count.
 */
export function addLeavesToGroup(
  root: FilterTreeNode,
  targetId: string,
  fields: FilterField[]
): { tree: FilterTreeNode; added: number } {
  const capacity = remainingCapacity(root)
  const toAdd = fields.slice(0, capacity)
  if (toAdd.length === 0) return { tree: root, added: 0 }

  const newLeaves = toAdd.map((f) => {
    const d = defaultsFor(f)
    // Adding a moving average defaults to the classic "Price <op> MA" comparison
    // (explicit current_price-vs-MA), so the row renders as a clean comparison.
    if (fieldType(f) === 'ma') {
      return makeLeaf('current_price' as FilterField, d.op, 0, f)
    }
    return makeLeaf(f, d.op, d.value)
  })

  function rebuild(branch: FilterTreeNode): FilterTreeNode {
    let children = (branch.children ?? []).map((ch) => (isLeaf(ch) ? ch : rebuild(ch)))
    if (branch.id === targetId) {
      children = [...children, ...newLeaves]
    }
    return { ...branch, children }
  }
  return { tree: rebuild(root), added: newLeaves.length }
}

/**
 * Immutably apply a partial update to the node with `id` (leaf condition fields
 * or branch logic/negate), returning a NEW tree.
 */
export function updateNode(
  root: FilterTreeNode,
  id: string,
  patch: Partial<Pick<FilterTreeNode, 'logic' | 'negate'>> & {
    condition?: Partial<NonNullable<FilterTreeNode['condition']>>
  }
): FilterTreeNode {
  function rebuild(node: FilterTreeNode): FilterTreeNode {
    if (node.id === id) {
      if (isLeaf(node) && patch.condition) {
        return { ...node, condition: { ...node.condition!, ...patch.condition } }
      }
      const next = { ...node }
      if (patch.logic !== undefined) next.logic = patch.logic
      if (patch.negate !== undefined) next.negate = patch.negate
      return next
    }
    if (isLeaf(node)) return node
    return { ...node, children: (node.children ?? []).map(rebuild) }
  }
  return rebuild(root)
}

/**
 * Set or clear a leaf's RHS comparison field (field-vs-field). Passing a field
 * turns the leaf into a price/MA comparison (both sides are floats), so it
 * coerces a non-strict operator (e.g. "=", ">=", "<=") to ">", since field
 * comparisons allow strict >/< only. Passing undefined clears it, reverting the
 * leaf to its implicit/value form. Returns a NEW tree.
 */
export function setLeafRhsField(
  root: FilterTreeNode,
  leafId: string,
  rhsField: FilterField | undefined
): FilterTreeNode {
  if (!rhsField) {
    return updateNode(root, leafId, { condition: { rhsField: undefined } })
  }
  const leaf = root.id === leafId ? root : findById(root, leafId)
  const op = leaf?.condition?.op
  const isStrict = op === '>' || op === '<'
  const patch: Partial<NonNullable<FilterTreeNode['condition']>> = { rhsField }
  if (!isStrict) patch.op = '>'
  return updateNode(root, leafId, { condition: patch })
}

/**
 * Change a leaf's LHS field, producing a VALID comparison-capable leaf while
 * PRESERVING the right-hand side the user already chose:
 *   - numeric / signal LHS → its default value / Yes-No row (rhsField cleared — these
 *     can't be field-vs-field);
 *   - price/MA LHS → keep the existing RHS when it stays valid (a price/MA field that
 *     isn't the new LHS). If the new LHS equals the current RHS, SWAP the old LHS into
 *     the RHS instead of dropping it. Only fall back to Price when nothing valid
 *     remains, and a moving average always gets a Price RHS (it can't compare a value).
 *
 * This fixes the footgun where switching the first field to an MA forced the second
 * field back to Price, making MA-vs-MA comparisons hard to build. Returns a NEW tree.
 */
export function setLeafField(
  root: FilterTreeNode,
  leafId: string,
  field: FilterField
): FilterTreeNode {
  // Non-comparison fields (RS/volume numerics, signals): reset to a value/Yes-No row
  // and clear any stale RHS — they can't participate in a field-vs-field comparison.
  if (!isPriceOrMA(field)) {
    const d = defaultsFor(field)
    return updateNode(root, leafId, {
      condition: { field, op: d.op, value: d.value, rhsField: undefined },
    })
  }

  const leaf = root.id === leafId ? root : findById(root, leafId)
  const cond = leaf?.condition
  const oldField = cond?.field
  const oldRhs = cond?.rhsField
  const oldOp = cond?.op

  // Keep the chosen RHS if it's still valid; otherwise swap in the old LHS (so the
  // field the user picked isn't lost on a self-compare); else leave it for a value RHS.
  let rhsField: FilterField | undefined =
    oldRhs != null && isPriceOrMA(oldRhs) && oldRhs !== field
      ? oldRhs
      : oldField != null && isPriceOrMA(oldField) && oldField !== field
        ? oldField
        : undefined

  // A moving average must compare against price or another MA, never a bare value.
  if (fieldType(field) === 'ma' && rhsField == null) rhsField = 'current_price' as FilterField

  // Field-vs-field (and any float LHS) is strict >/< only: carry over a strict op,
  // otherwise coerce a stale '>=' / '<=' / '=' to '>'.
  const op: FilterOperator = oldOp === '>' || oldOp === '<' ? oldOp : '>'

  if (rhsField != null) {
    return updateNode(root, leafId, { condition: { field, op, value: 0, rhsField } })
  }
  // current_price compared to a value (no field RHS): keep the user's number.
  const d = defaultsFor(field)
  const value = typeof cond?.value === 'number' ? cond.value : d.value
  return updateNode(root, leafId, { condition: { field, op, value, rhsField: undefined } })
}

/**
 * Immutably append a new empty branch (group) to `targetId`'s children. The new
 * group's logic flips relative to the parent (AND→OR, OR→AND) mirroring the
 * prototype. Returns a NEW tree.
 */
export function addGroup(root: FilterTreeNode, targetId: string): FilterTreeNode {
  function rebuild(branch: FilterTreeNode): FilterTreeNode {
    let children = (branch.children ?? []).map((ch) => (isLeaf(ch) ? ch : rebuild(ch)))
    if (branch.id === targetId) {
      const childLogic = branch.logic === 'and' ? 'or' : 'and'
      children = [...children, { id: uid(), logic: childLogic, negate: false, children: [] }]
    }
    return { ...branch, children }
  }
  return rebuild(root)
}

/**
 * Depth of a branch within the tree, root = 1 (matches the prototype's
 * `data-depth` band convention and the backend cap where root→group→leaf = 3).
 * Returns `null` if the id is not found.
 */
export function depthOf(root: FilterTreeNode, id: string, depth = 1): number | null {
  if (root.id === id) return depth
  for (const ch of root.children ?? []) {
    if (!isLeaf(ch)) {
      const found = depthOf(ch, id, depth + 1)
      if (found != null) return found
    }
  }
  return null
}

/** List every branch (group) in the tree with its id + a short label, for the "Move to group…" menu. */
export interface GroupRef {
  id: string
  depth: number
}
export function listGroups(root: FilterTreeNode, depth = 1): GroupRef[] {
  if (isLeaf(root)) return []
  const out: GroupRef[] = [{ id: root.id, depth }]
  for (const ch of root.children ?? []) {
    if (!isLeaf(ch)) out.push(...listGroups(ch, depth + 1))
  }
  return out
}
