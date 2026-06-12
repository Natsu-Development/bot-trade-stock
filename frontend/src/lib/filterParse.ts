import type { FilterField, FilterOperator, FilterTreeNode } from '@/types'
import { MAX_FILTER_CONDITIONS, MAX_FILTER_DEPTH } from '@/types'
import { SCREENER_FIELD_OPTIONS, isFloatField, isPriceOrMA } from './screenerFilterOptions'
import {
  fieldLabel,
  fieldType,
  isLeaf,
  makeBranch,
  makeLeaf,
  type FormulaTokenKind,
} from './filterSerialize'
import { countLeaves } from './filterTreeOps'

/**
 * Typed parse error. `parseFormula` only ever throws this — callers can render
 * `error.message` inline and keep the last valid filter (never a hard crash).
 */
export class FilterParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FilterParseError'
  }
}

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

interface LabelEntry {
  label: string
  field: string
}

// Labels longest-first so superstring labels win (e.g. "Last Price" beats the
// "Price" alias, "Vol x SMA" / "Vol SMA20" beat "Volume", "RS 52W" vs "RS 1M",
// "EMA 50" vs "EMA 9"). "Price" is a plain alias for the real current_price field.
const LABELS: LabelEntry[] = [
  ...SCREENER_FIELD_OPTIONS.map((o): LabelEntry => ({ label: o.label, field: o.value })),
  { label: 'Price', field: 'current_price' },
].sort((a, b) => b.label.length - a.label.length)

type Token =
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'log'; v: 'AND' | 'OR' }
  | { t: 'not' }
  | { t: 'cmp'; v: FilterOperator }
  | { t: 'field'; field: string; label: string }
  | { t: 'val'; bool?: boolean; num?: number }

function tokenize(str: string): Token[] {
  const toks: Token[] = []
  let pos = 0
  while (pos < str.length) {
    const rest = str.slice(pos)
    if (/\s/.test(rest[0])) {
      pos++
      continue
    }
    if (rest[0] === '(') {
      toks.push({ t: 'lp' })
      pos++
      continue
    }
    if (rest[0] === ')') {
      toks.push({ t: 'rp' })
      pos++
      continue
    }
    let m = /^(and|or|not)\b/i.exec(rest)
    if (m) {
      const w = m[1].toUpperCase()
      toks.push(w === 'NOT' ? { t: 'not' } : { t: 'log', v: w as 'AND' | 'OR' })
      pos += m[1].length
      continue
    }
    m = /^(>=|<=|>|<|=)/.exec(rest)
    if (m) {
      toks.push({ t: 'cmp', v: m[1] as FilterOperator })
      pos += m[1].length
      continue
    }
    // Longest-match field label (case-insensitive).
    let matched: LabelEntry | null = null
    for (const entry of LABELS) {
      if (rest.slice(0, entry.label.length).toLowerCase() === entry.label.toLowerCase()) {
        matched = entry
        break
      }
    }
    if (matched) {
      toks.push({ t: 'field', field: matched.field, label: matched.label })
      pos += matched.label.length
      continue
    }
    m = /^(yes|true)\b/i.exec(rest)
    if (m) {
      toks.push({ t: 'val', bool: true })
      pos += m[1].length
      continue
    }
    m = /^(no|false)\b/i.exec(rest)
    if (m) {
      toks.push({ t: 'val', bool: false })
      pos += m[1].length
      continue
    }
    m = /^-?\d+\.?\d*/.exec(rest)
    if (m) {
      toks.push({ t: 'val', num: parseFloat(m[0]) })
      pos += m[0].length
      continue
    }
    throw new FilterParseError(`Unexpected "${rest.slice(0, 14)}"`)
  }
  return toks
}

/* ------------------------------------------------------------------ */
/* Non-throwing highlight lexer (colored editable box)                 */
/* ------------------------------------------------------------------ */

/** Highlight span kinds — the display token kinds plus `'plain'` for spans the
 *  lexer cannot classify (so partial / invalid input still colorizes). */
export type HighlightKind = FormulaTokenKind | 'plain'

export interface HighlightSpan {
  start: number
  end: number
  kind: HighlightKind
}

/**
 * Lex raw formula text into colorable `{start,end,kind}` spans for the editable
 * box's highlight layer. UNLIKE `tokenize`, this NEVER throws: it skips
 * whitespace and emits a one-char `'plain'` span for any run it cannot classify,
 * so half-typed (`RS 52W >=`) and invalid (`((( AND`) text still paints. The
 * recognition order mirrors `tokenize` (parens → AND/OR/NOT → comparators →
 * longest-match field labels incl. the `Price` marker → Yes/No → numbers).
 */
export function lexForHighlight(str: string): HighlightSpan[] {
  const spans: HighlightSpan[] = []
  let pos = 0
  while (pos < str.length) {
    if (/\s/.test(str[pos])) {
      pos++
      continue
    }
    const rest = str.slice(pos)
    if (str[pos] === '(' || str[pos] === ')') {
      spans.push({ start: pos, end: pos + 1, kind: 'paren' })
      pos++
      continue
    }
    let m = /^(and|or|not)\b/i.exec(rest)
    if (m) {
      const kind: HighlightKind = m[1].toUpperCase() === 'NOT' ? 'not' : 'logic'
      spans.push({ start: pos, end: pos + m[1].length, kind })
      pos += m[1].length
      continue
    }
    m = /^(>=|<=|>|<|=)/.exec(rest)
    if (m) {
      spans.push({ start: pos, end: pos + m[1].length, kind: 'op' })
      pos += m[1].length
      continue
    }
    // Longest-match field label (case-insensitive), incl. the synthetic "Price".
    let matched: LabelEntry | null = null
    for (const entry of LABELS) {
      if (rest.slice(0, entry.label.length).toLowerCase() === entry.label.toLowerCase()) {
        matched = entry
        break
      }
    }
    if (matched) {
      spans.push({ start: pos, end: pos + matched.label.length, kind: 'field' })
      pos += matched.label.length
      continue
    }
    m = /^(yes|true|no|false)\b/i.exec(rest)
    if (m) {
      spans.push({ start: pos, end: pos + m[1].length, kind: 'value' })
      pos += m[1].length
      continue
    }
    m = /^-?\d+\.?\d*/.exec(rest)
    if (m && m[0].length > 0) {
      spans.push({ start: pos, end: pos + m[0].length, kind: 'value' })
      pos += m[0].length
      continue
    }
    // Unclassifiable char → one 'plain' span; keep going (never throw).
    spans.push({ start: pos, end: pos + 1, kind: 'plain' })
    pos++
  }
  return spans
}

/* ------------------------------------------------------------------ */
/* Recursive-descent parser                                            */
/* ------------------------------------------------------------------ */

/**
 * Parse a formula string into a `FilterTreeNode` tree. Whitespace/newline
 * insensitive (the pretty multi-line form re-parses). Throws `FilterParseError`
 * with a human-readable message on any invalid input. Enforces the canonical
 * grammar, signal-`=`, depth ≤ 3, and ≤ 50 global leaves.
 *
 * Returns a canonical tree: single-child groups collapse to their child, so a
 * pretty → parse → pretty round-trip is structurally stable.
 */
export function parseFormula(str: string): FilterTreeNode {
  if (!str.trim()) return makeBranch('and', [])
  const toks = tokenize(str)
  let i = 0
  const peek = (): Token | undefined => toks[i]
  const next = (): Token | undefined => toks[i++]

  // expr = term (OR term)*
  function expr(): FilterTreeNode {
    const first = term()
    const items: FilterTreeNode[] = [first]
    let used = false
    let p = peek()
    while (p && p.t === 'log' && p.v === 'OR') {
      next()
      items.push(term())
      used = true
      p = peek()
    }
    if (!used) return first
    return makeBranch('or', items)
  }

  // term = factor (AND factor)*
  function term(): FilterTreeNode {
    const first = factor()
    const items: FilterTreeNode[] = [first]
    let used = false
    let p = peek()
    while (p && p.t === 'log' && p.v === 'AND') {
      next()
      items.push(factor())
      used = true
      p = peek()
    }
    if (!used) return first
    return makeBranch('and', items)
  }

  // factor = NOT factor | '(' expr ')' | condition
  function factor(): FilterTreeNode {
    const p = peek()
    if (p && p.t === 'not') {
      next()
      const inner = factor()
      if (!isLeaf(inner)) {
        inner.negate = !inner.negate
        return inner
      }
      // NOT applied to a bare leaf → wrap in a negated AND group.
      const g = makeBranch('and', [inner])
      g.negate = true
      return g
    }
    if (p && p.t === 'lp') {
      next()
      const e = expr()
      const close = next()
      if (!close || close.t !== 'rp') throw new FilterParseError('Missing ")"')
      // A parenthesized leaf becomes a single-child group (preserves grouping).
      if (isLeaf(e)) return makeBranch('and', [e])
      return e
    }
    return condition()
  }

  // condition = field cmp value | field cmp field (comparison) | 'Price' cmp ma-field (legacy)
  function condition(): FilterTreeNode {
    const f = next()
    if (!f || f.t !== 'field') {
      const near = f && 'label' in f ? ` near "${f.label}"` : f ? ` near "${f.t}"` : ''
      throw new FilterParseError(`Expected a metric${near}`)
    }
    const op = next()
    if (!op || op.t !== 'cmp') {
      throw new FilterParseError(`Expected an operator after "${f.label}"`)
    }
    const field = f.field as FilterField
    const t = fieldType(field)
    // Field-vs-field comparison: the token after the operator is another field
    // (e.g. "EMA 9 >= EMA 21", "Last Price < EMA 50", "EMA 50 > Price"). "Price" is
    // a plain alias for current_price, so it needs no special handling here.
    const rhsTok = peek()
    if (rhsTok && rhsTok.t === 'field') {
      next() // consume the RHS field token
      const rhsField = rhsTok.field as FilterField
      // Both sides are price/MA floats — strict >/< only (never exactly equal).
      if (op.v !== '>' && op.v !== '<') {
        throw new FilterParseError(`"${op.v}" is not allowed for a field comparison — use > or <`)
      }
      if (!isPriceOrMA(field) || !isPriceOrMA(rhsField)) {
        throw new FilterParseError(
          `Field comparison requires price or moving-average fields on both sides`
        )
      }
      if (field === rhsField) {
        throw new FilterParseError(`Cannot compare "${fieldLabel(field)}" to itself`)
      }
      return makeLeaf(field, op.v, 0, rhsField)
    }
    // A moving average must be compared to price or another MA — never to a bare
    // number (mirrors the backend ErrMovingAverageRequiresComparison).
    if (t === 'ma') {
      throw new FilterParseError(
        `"${f.label}" is a moving average — compare it to Price or another moving average (e.g. "${f.label} > EMA 21")`
      )
    }
    const vt = next()
    if (!vt || vt.t !== 'val') {
      throw new FilterParseError(`Expected a value after "${f.label} ${op.v}"`)
    }
    if (t === 'sig') {
      if (op.v !== '=') {
        throw new FilterParseError(`"${f.label}" is a signal — only "=" is allowed`)
      }
      if (typeof vt.bool !== 'boolean') {
        throw new FilterParseError(`"${f.label}" needs Yes/No, not a number`)
      }
      return makeLeaf(field, '=', vt.bool === true)
    }
    if (typeof vt.num !== 'number') {
      throw new FilterParseError(`"${f.label}" needs a number, not Yes/No`)
    }
    if (isFloatField(field)) {
      // Continuous floats never land exactly on a threshold — strict >/< only
      // (mirrors the backend ErrFloatOperatorUnsupported).
      if (op.v !== '>' && op.v !== '<') {
        throw new FilterParseError(`"${f.label}" is a decimal value — compare with > or < only`)
      }
    } else if (op.v === '=') {
      // Integer fields (RS, volume) keep >=/<= but '=' is a silent always-false
      // footgun (mirrors the backend ErrNumericEqualityUnsupported).
      throw new FilterParseError(
        `"=" is not allowed for "${f.label}" — numbers compare with >, >=, <, <=`
      )
    }
    return makeLeaf(field, op.v, vt.num)
  }

  const tree = expr()
  if (i < toks.length) {
    const x = toks[i]
    const near = x.t === 'field' ? x.label : x.t === 'log' ? x.v : x.t === 'cmp' ? x.v : x.t
    throw new FilterParseError(`Unexpected "${near}"`)
  }

  // Normalize the root to a branch.
  const root = isLeaf(tree) ? makeBranch('and', [tree]) : tree
  validateCaps(root)
  return root
}

/* ------------------------------------------------------------------ */
/* Cap validation (depth ≤ 3, ≤ 50 global leaves)                      */
/* ------------------------------------------------------------------ */

/**
 * Max depth of any node, mirroring the backend `validate(depth)` convention:
 * the root is depth 1 and EVERY child (branches AND leaves) is one level deeper.
 * So root→leaf = 2, root→group→leaf = 3, root→group→group→leaf = 4 (rejected).
 */
function nodeDepth(node: FilterTreeNode, depth: number): number {
  if (isLeaf(node)) return depth
  const children = node.children ?? []
  let deepest = depth
  for (const ch of children) {
    deepest = Math.max(deepest, nodeDepth(ch, depth + 1))
  }
  return deepest
}

/* ------------------------------------------------------------------ */
/* Screener formula-box input resolution (S5)                          */
/* ------------------------------------------------------------------ */

/**
 * Max characters accepted by the screener formula box, mirroring the backend
 * `maxFilterBodyBytes` (256 KiB) `MaxBytesReader` guard (S5 AC6). Input past
 * this is truncated so a giant paste can never hang the parser or reach the API.
 */
export const MAX_FORMULA_CHARS = 256 << 10 // 256 KiB

/**
 * Pure decision for the screener formula box (S5). Given the raw textarea text,
 * resolve what the UI should do — WITHOUT touching React state — so the
 * debounced-parse-apply reducer can be unit-tested in isolation:
 *
 *  - `cap`   → input exceeded `MAX_FORMULA_CHARS`; `text` is the truncated value.
 *  - `empty` → blank input → commit an empty AND-branch (return-all) + show the
 *              explicit "no filter — all stocks" hint (NEVER a silent return-all).
 *  - `ok`    → parsed successfully; `tree` is the new canonical tree to commit.
 *  - `error` → parse failed; `message` is the inline `✗` text; the caller KEEPS
 *              the last valid tree (no commit).
 */
export type FormulaResolution =
  | { kind: 'cap'; text: string }
  | { kind: 'empty'; tree: FilterTreeNode }
  | { kind: 'ok'; tree: FilterTreeNode }
  | { kind: 'error'; message: string }

export function resolveFormulaInput(text: string): FormulaResolution {
  if (text.length > MAX_FORMULA_CHARS) {
    return { kind: 'cap', text: text.slice(0, MAX_FORMULA_CHARS) }
  }
  if (!text.trim()) {
    return { kind: 'empty', tree: makeBranch('and', []) }
  }
  try {
    return { kind: 'ok', tree: parseFormula(text) }
  } catch (e) {
    const message = e instanceof FilterParseError ? e.message : String(e)
    return { kind: 'error', message }
  }
}

/** Throws `FilterParseError` if the tree exceeds the depth / global-leaf caps. */
export function validateCaps(root: FilterTreeNode): void {
  const leaves = countLeaves(root)
  if (leaves > MAX_FILTER_CONDITIONS) {
    throw new FilterParseError(`Too many conditions (${leaves}) — max ${MAX_FILTER_CONDITIONS}`)
  }
  // Root = depth 1; each nested level (incl. the leaf) adds 1. Cap = MaxFilterDepth.
  const depth = nodeDepth(root, 1)
  if (depth > MAX_FILTER_DEPTH) {
    throw new FilterParseError(`Too deeply nested (depth ${depth}) — max ${MAX_FILTER_DEPTH}`)
  }
}
