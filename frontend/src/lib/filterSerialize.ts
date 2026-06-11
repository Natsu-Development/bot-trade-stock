import type {
  DynamicFilter,
  FilterField,
  FilterLogic,
  FilterOperator,
  FilterTreeNode,
} from '@/types'
import type { ApiCondition, ApiGroup, ApiStockFilter } from './api'
import { SCREENER_FIELD_OPTIONS, isMAField, isSignalField } from './screenerFilterOptions'

/* ------------------------------------------------------------------ */
/* Field metadata (ported from the prototype FIELDS / FMAP)            */
/* ------------------------------------------------------------------ */

export type FilterFieldType = 'num' | 'ma' | 'sig'

/** Discriminate a field's value type (numeric / moving-average / signal-boolean). */
export function fieldType(field: FilterField): FilterFieldType {
  if (isSignalField(field)) return 'sig'
  if (isMAField(field)) return 'ma'
  return 'num'
}

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  SCREENER_FIELD_OPTIONS.map((o) => [o.value, o.label])
)

/** Human label for a field (the canonical parser token). */
export function fieldLabel(field: FilterField): string {
  return FIELD_LABEL[field] ?? field
}

/* ------------------------------------------------------------------ */
/* Node construction helpers                                           */
/* ------------------------------------------------------------------ */

let uidCounter = 1
/** Client-only unique id for React keys / inline editing. */
export function uid(): string {
  return `n${uidCounter++}`
}

/** A branch node (default AND, no negate, no children). */
export function makeBranch(
  logic: FilterLogic = 'and',
  children: FilterTreeNode[] = []
): FilterTreeNode {
  return { id: uid(), logic, negate: false, children }
}

/**
 * A leaf node carrying a single condition. When `rhsField` is provided the leaf
 * is a field-vs-field comparison (e.g. EMA 9 >= EMA 21) and `value` is unused
 * (pass 0).
 */
export function makeLeaf(
  field: FilterField,
  op: FilterOperator,
  value: number | boolean,
  rhsField?: FilterField
): FilterTreeNode {
  return { id: uid(), condition: { field, op, value, ...(rhsField ? { rhsField } : {}) } }
}

/** True when the node is a leaf (carries a condition). */
export function isLeaf(node: FilterTreeNode): boolean {
  return node.condition != null
}

/** Coerce a leaf's stored value to a boolean (signal fields). */
function boolVal(value: number | boolean): boolean {
  return value === true
}

/* ------------------------------------------------------------------ */
/* Formula serialization (single-line + pretty multi-line)             */
/* ------------------------------------------------------------------ */

/** Format a single leaf condition as formula text. */
function formatCondition(cond: NonNullable<FilterTreeNode['condition']>): string {
  const label = fieldLabel(cond.field)
  // Field-vs-field comparison takes precedence (e.g. "EMA 9 >= EMA 21",
  // "Last Price < EMA 50"). Both operands render with their canonical labels.
  if (cond.rhsField != null) return `${label} ${cond.op} ${fieldLabel(cond.rhsField)}`
  const t = fieldType(cond.field)
  if (t === 'sig') return `${label} = ${boolVal(cond.value) ? 'Yes' : 'No'}`
  if (t === 'ma') return `Price ${cond.op} ${label}`
  return `${label} ${cond.op} ${cond.value}`
}

/**
 * Serialize a node to a single-line formula string.
 * Ported from the prototype `serializeFormula`. `top` suppresses the outer
 * parens at the root; nested multi-child branches are wrapped in `( )`.
 */
export function serializeFormula(node: FilterTreeNode, top = true): string {
  if (isLeaf(node)) return formatCondition(node.condition!)
  const children = node.children ?? []
  const parts = children.map((ch) => serializeFormula(ch, false))
  if (parts.length === 0) return node.negate ? 'NOT ()' : ''
  const body = parts.join(node.logic === 'or' ? ' OR ' : ' AND ')
  if (node.negate) return `NOT (${body})`
  if (!top && parts.length > 1) return `(${body})`
  return body
}

/**
 * Pretty (multi-line, indented) lines for a branch's children. The AND/OR
 * connector TRAILS each line (except the last) so each condition reads first
 * and the connector ends the line — e.g. "RS 52W >= 70 AND" / "Vol x SMA >= 1.5".
 * For a nested group the connector trails its closing ")".
 */
function prettyBranchLines(node: FilterTreeNode, indent: number): string[] {
  const pad = '  '.repeat(indent)
  const op = node.logic === 'or' ? 'OR' : 'AND'
  const lines: string[] = []
  const children = node.children ?? []
  children.forEach((ch, i) => {
    const suffix = i === children.length - 1 ? '' : ` ${op}`
    if (isLeaf(ch)) {
      lines.push(pad + formatCondition(ch.condition!) + suffix)
    } else {
      lines.push(`${pad}${ch.negate ? 'NOT ' : ''}(`)
      lines.push(...prettyBranchLines(ch, indent + 1))
      lines.push(`${pad})${suffix}`)
    }
  })
  return lines
}

/**
 * Pretty-print the root node as a multi-line, indented formula (ONE condition per
 * line, trailing connector). Root must be a branch. LEGACY/alternate serializer:
 * the editable screener box now seeds from `formulaToText` (the FilterFormula
 * layout); this remains exported as an independent round-trip oracle in tests.
 */
export function prettyFormula(root: FilterTreeNode): string {
  // A bare-leaf root is treated as a single-child AND for rendering parity.
  if (isLeaf(root)) return formatCondition(root.condition!)
  const children = root.children ?? []
  if (children.length === 0) return ''
  if (root.negate) return ['NOT (', ...prettyBranchLines(root, 1), ')'].join('\n')
  return prettyBranchLines(root, 0).join('\n')
}

/* ------------------------------------------------------------------ */
/* Structured (colorable) segments for DISPLAY                          */
/* ------------------------------------------------------------------ */

export type FormulaTokenKind = 'field' | 'op' | 'value' | 'logic' | 'not' | 'paren'
export interface FormulaToken {
  kind: FormulaTokenKind
  text: string
}
export interface FormulaLine {
  indent: number
  tokens: FormulaToken[]
}

/** Tokens for a single leaf condition (mirrors `formatCondition`'s wording). */
function leafTokens(cond: NonNullable<FilterTreeNode['condition']>): FormulaToken[] {
  const label = fieldLabel(cond.field)
  // Field-vs-field comparison: both operands are 'field' tokens (e.g. EMA 9 >= EMA 21).
  if (cond.rhsField != null) {
    return [
      { kind: 'field', text: label },
      { kind: 'op', text: cond.op },
      { kind: 'field', text: fieldLabel(cond.rhsField) },
    ]
  }
  const t = fieldType(cond.field)
  if (t === 'sig') {
    return [
      { kind: 'field', text: label },
      { kind: 'op', text: '=' },
      { kind: 'value', text: boolVal(cond.value) ? 'Yes' : 'No' },
    ]
  }
  if (t === 'ma') {
    return [
      { kind: 'field', text: 'Price' },
      { kind: 'op', text: cond.op },
      { kind: 'field', text: label },
    ]
  }
  return [
    { kind: 'field', text: label },
    { kind: 'op', text: cond.op },
    { kind: 'value', text: String(cond.value) },
  ]
}

/**
 * Inline-per-level lines: SAME-LEVEL leaf conditions share one line (joined by the
 * group's connector); a nested sub-group breaks onto its own indented line(s),
 * with its opening "(" trailing the current line and ")" closing on its own line.
 */
function branchLines(node: FilterTreeNode, indent: number): FormulaLine[] {
  const opText = node.logic === 'or' ? 'OR' : 'AND'
  const children = node.children ?? []
  const lines: FormulaLine[] = []
  let current: FormulaToken[] = []
  children.forEach((ch, i) => {
    const isLast = i === children.length - 1
    if (isLeaf(ch)) {
      current.push(...leafTokens(ch.condition!))
      if (!isLast) current.push({ kind: 'logic', text: opText })
      return
    }
    // Nested group → break onto its own indented line(s).
    if (ch.negate) current.push({ kind: 'not', text: 'NOT' })
    current.push({ kind: 'paren', text: '(' })
    lines.push({ indent, tokens: current })
    lines.push(...branchLines(ch, indent + 1))
    const close: FormulaToken[] = [{ kind: 'paren', text: ')' }]
    if (!isLast) close.push({ kind: 'logic', text: opText })
    lines.push({ indent, tokens: close })
    current = []
  })
  if (current.length) lines.push({ indent, tokens: current })
  return lines
}

/**
 * Structured, colorable formula for DISPLAY. Same-level conditions render inline on
 * one line; nested groups break onto indented lines. Presentational only — the
 * tree is the source of truth. `formulaToText` (derived from this) drives the
 * editable screener box, and `parseFormula` accepts that text (whitespace-
 * insensitive), so the display, the editor, and the parser all stay in lock-step.
 */
export function formulaSegments(root: FilterTreeNode): FormulaLine[] {
  if (isLeaf(root)) return [{ indent: 0, tokens: leafTokens(root.condition!) }]
  if ((root.children ?? []).length === 0) return []
  if (root.negate) {
    return [
      {
        indent: 0,
        tokens: [
          { kind: 'not', text: 'NOT' },
          { kind: 'paren', text: '(' },
        ],
      },
      ...branchLines(root, 1),
      { indent: 0, tokens: [{ kind: 'paren', text: ')' }] },
    ]
  }
  return branchLines(root, 0)
}

/**
 * Flatten the structured `formulaSegments` layout into editable formula TEXT — the
 * SAME line structure `FilterFormula` renders (same-level conditions inline, nested
 * groups on their own indented lines). The editable screener box and the read-only
 * config/builder displays thus share ONE layout source, so they always read
 * identically. Whitespace/newline-insensitive, so `parseFormula` round-trips it.
 * An empty branch → '' (the "no filter — all stocks" state).
 */
export function formulaToText(root: FilterTreeNode): string {
  return formulaSegments(root)
    .map((line) => '  '.repeat(line.indent) + line.tokens.map((t) => t.text).join(' '))
    .join('\n')
}

/**
 * Tailwind class per formula token kind — the SINGLE source of truth for formula
 * coloring, shared by the read-only `FilterFormula` renderer and the editable
 * `ColoredFormulaEditor` highlight layer. `'plain'` covers editor-only spans
 * (whitespace-adjacent unrecognized text) and renders as primary text.
 *   field → white · op/paren → muted · value → amber · AND → bull · OR → cyan ·
 *   NOT → bear.
 */
export function formulaTokenClass(kind: FormulaTokenKind | 'plain', text?: string): string {
  switch (kind) {
    case 'op':
    case 'paren':
      return 'text-[var(--text-muted)]'
    case 'value':
      return 'text-[var(--neon-amber)]'
    case 'logic':
      return text === 'OR'
        ? 'font-semibold text-[var(--neon-cyan)]'
        : 'font-semibold text-[var(--neon-bull)]'
    case 'not':
      return 'font-semibold text-[var(--neon-bear)]'
    case 'field':
    case 'plain':
    default:
      return 'text-[var(--text-primary)]'
  }
}

/* ------------------------------------------------------------------ */
/* API (wire) serialization — flat two-level normal form               */
/* ------------------------------------------------------------------ */

/**
 * Serialize a leaf to a flat wire condition. A signal value is a JSON boolean
 * (op "="), an MA condition omits `value` (the comparison is Price vs the MA
 * field, carried by `op`), and a numeric value is a number.
 */
function leafToCondition(node: FilterTreeNode): ApiCondition {
  const cond = node.condition!
  // Field-vs-field comparison: carry rhs_field, omit value (the RHS is a field).
  if (cond.rhsField != null) return { field: cond.field, op: cond.op, rhs_field: cond.rhsField }
  const t = fieldType(cond.field)
  if (t === 'sig') return { field: cond.field, op: cond.op, value: boolVal(cond.value) }
  if (t === 'ma') return { field: cond.field, op: cond.op }
  return { field: cond.field, op: cond.op, value: Number(cond.value) }
}

/**
 * Build the flat `{ match, conditions, groups, exchanges? }` payload from a tree.
 * The tree's top level is split into top-level conditions (leaf children) and
 * groups (branch children, each one level of conditions). A bare-leaf root is
 * treated as a single top-level condition. Empty `conditions`/`groups`/
 * `exchanges` are omitted so the wire stays minimal.
 */
export function mapTreeToApiFormat(root: FilterTreeNode, exchanges?: string[]): ApiStockFilter {
  if (isLeaf(root)) {
    return {
      match: 'and',
      conditions: [leafToCondition(root)],
      ...(exchanges?.length ? { exchanges } : {}),
    }
  }
  const conditions: ApiCondition[] = []
  const groups: ApiGroup[] = []
  for (const child of root.children ?? []) {
    if (isLeaf(child)) {
      conditions.push(leafToCondition(child))
    } else {
      groups.push({
        match: child.logic ?? 'and',
        ...(child.negate ? { negate: true } : {}),
        conditions: (child.children ?? []).filter(isLeaf).map(leafToCondition),
      })
    }
  }
  return {
    match: root.logic ?? 'and',
    ...(root.negate ? { negate: true } : {}),
    ...(conditions.length ? { conditions } : {}),
    ...(groups.length ? { groups } : {}),
    ...(exchanges?.length ? { exchanges } : {}),
  }
}

/**
 * Hydrate a flat wire condition into a client leaf with a fresh id. An MA
 * condition's value is normalized to 0; a signal value is coerced truthy — a
 * saved preset reads back as `value: 1` (float storage), not `true`, so both
 * `true` and `1` are accepted.
 */
function conditionToLeaf(c: ApiCondition): FilterTreeNode {
  const field = c.field as FilterField
  // Field-vs-field comparison: hydrate rhsField, value is unused (0).
  if (c.rhs_field != null) {
    return makeLeaf(field, (c.op ?? '>') as FilterOperator, 0, c.rhs_field as FilterField)
  }
  const t = fieldType(field)
  const value: number | boolean =
    t === 'sig' ? c.value === true || Number(c.value) === 1 : t === 'ma' ? 0 : Number(c.value ?? 0)
  return makeLeaf(field, (c.op ?? '>=') as FilterOperator, value)
}

/**
 * Inverse of `mapTreeToApiFormat`: rebuild the internal builder tree from a flat
 * payload (preset load / API response). Top-level conditions become leaf children
 * and each group becomes a branch child; the top-level negate is preserved.
 */
export function apiNodeToTree(f: ApiStockFilter): FilterTreeNode {
  const condChildren = (f.conditions ?? []).map(conditionToLeaf)
  const groupChildren = (f.groups ?? []).map((g) => {
    const branch = makeBranch(g.match ?? 'and', (g.conditions ?? []).map(conditionToLeaf))
    branch.negate = !!g.negate
    return branch
  })
  const root = makeBranch(f.match ?? 'and', [...condChildren, ...groupChildren])
  root.negate = !!f.negate
  return root
}

/** Convenience: full filter request including exchanges. */
export function mapTreeToApiRequest(root: FilterTreeNode, exchanges?: string[]): ApiStockFilter {
  return mapTreeToApiFormat(root, exchanges)
}

/* ------------------------------------------------------------------ */
/* Flat <-> tree bridges (simple-view helpers)                         */
/* ------------------------------------------------------------------ */

/** Default leaf value for a freshly added field. */
function defaultValueFor(field: FilterField): number | boolean {
  const t = fieldType(field)
  if (t === 'sig') return true
  if (t === 'ma') return 0
  return 0
}

/**
 * Build a single-level tree from a flat list of dynamic filters joined by one
 * logic operator. Drops incomplete numeric leaves (empty value). Signal/MA
 * values are normalized.
 */
export function flatToTree(dynamicFilters: DynamicFilter[], logic: FilterLogic): FilterTreeNode {
  const children: FilterTreeNode[] = []
  for (const f of dynamicFilters) {
    const t = fieldType(f.field)
    if (t === 'sig') {
      children.push(makeLeaf(f.field, '=', typeof f.value === 'boolean' ? f.value : true))
    } else if (t === 'ma') {
      children.push(makeLeaf(f.field, f.operator, 0))
    } else {
      if (f.value === '' || Number.isNaN(Number(f.value))) continue
      children.push(makeLeaf(f.field, f.operator, Number(f.value)))
    }
  }
  return makeBranch(logic, children)
}

/**
 * Flatten a tree back to the simple (flat-filters + single logic) view.
 * Returns `null` when the tree cannot be represented flatly — i.e. it contains
 * a sub-group (nested branch) or any negation. Mirrors the backend's
 * "simple toggle disabled" semantics.
 */
export function treeToFlat(
  root: FilterTreeNode
): { filters: DynamicFilter[]; logic: FilterLogic } | null {
  if (isLeaf(root)) {
    const cond = root.condition!
    // A field-vs-field comparison has no flat (DynamicFilter) representation.
    if (cond.rhsField != null) return null
    return {
      filters: [{ id: uid(), field: cond.field, operator: cond.op, value: cond.value }],
      logic: 'and',
    }
  }
  if (root.negate) return null
  const children = root.children ?? []
  const filters: DynamicFilter[] = []
  for (const ch of children) {
    // Any nested branch, negation, or field comparison → not flat-representable.
    if (!isLeaf(ch)) return null
    if (ch.negate) return null
    const cond = ch.condition!
    if (cond.rhsField != null) return null
    filters.push({ id: uid(), field: cond.field, operator: cond.op, value: cond.value })
  }
  return { filters, logic: root.logic ?? 'and' }
}

/* ------------------------------------------------------------------ */
/* Canonical form (structural round-trip comparison)                   */
/* ------------------------------------------------------------------ */

/** Structural shape of a node with client ids stripped (for comparison). */
export interface CanonicalNode {
  logic?: FilterLogic
  negate?: boolean
  children?: CanonicalNode[]
  condition?: {
    field: FilterField
    op: FilterOperator
    value: number | boolean
    rhsField?: FilterField
  }
}

/**
 * Canonical structural form for round-trip stability assertions: client `id`s
 * are dropped, a non-negated single-child group collapses to its child, and a
 * leaf's MA value is normalized to 0. This defines the equivalence class so a
 * `parse(pretty(t))` round-trip can be compared structurally — the prototype's
 * single-child `or→and` drift cannot pass falsely.
 */
export function canonicalizeTree(node: FilterTreeNode): CanonicalNode {
  if (isLeaf(node)) {
    const c = node.condition!
    // Field-vs-field comparison: value is unused — normalize to 0 and carry
    // rhsField so structural round-trip equality reflects the RHS.
    if (c.rhsField != null) {
      return { condition: { field: c.field, op: c.op, value: 0, rhsField: c.rhsField } }
    }
    return { condition: { field: c.field, op: c.op, value: c.value } }
  }
  const children = (node.children ?? []).map(canonicalizeTree)
  // Collapse a non-negated single-child group to its child.
  if (!node.negate && children.length === 1) {
    return children[0]
  }
  const out: CanonicalNode = { logic: node.logic ?? 'and', children }
  if (node.negate) out.negate = true
  return out
}

/**
 * Structural equality of two filter trees in their CANONICAL form — client ids
 * ignored, non-negated single-child groups collapsed, MA values normalized (see
 * `canonicalizeTree`). `canonicalizeTree` emits keys in a fixed order, so a stable
 * `JSON.stringify` comparison is sound. Used for preset provenance ("is the edited
 * tree still the loaded preset?") and apply state ("do the results match the
 * edited query?").
 */
export function treesEqual(a: FilterTreeNode, b: FilterTreeNode): boolean {
  return JSON.stringify(canonicalizeTree(a)) === JSON.stringify(canonicalizeTree(b))
}

export { defaultValueFor }
