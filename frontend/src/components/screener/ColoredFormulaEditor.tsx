import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formulaTokenClass, formulaToText } from '@/lib/filterSerialize'
import {
  lexForHighlight,
  resolveFormulaInput,
  MAX_FORMULA_CHARS,
  type HighlightSpan,
} from '@/lib/filterParse'
import type { FilterTreeNode } from '@/types'

/** Debounce window for live parsing — snappy valid/invalid feedback without
 *  flooding the parser mid-type. */
const PARSE_DEBOUNCE_MS = 150

type FormulaStatus = { kind: 'ok' } | { kind: 'empty' } | { kind: 'error'; message: string }

interface ColoredFormulaEditorProps {
  /** Canonical tree to seed/display — the external source of truth. */
  tree: FilterTreeNode
  /** Commit a parsed tree (valid parse or empty box). Parse errors keep the
   *  last valid tree (no commit) and surface inline. */
  onTreeChange: (root: FilterTreeNode) => void
}

/** Shared text metrics — IDENTICAL on the textarea and the colored mirror so the
 *  two layers wrap and align pixel-for-pixel. */
const TEXT_METRICS =
  'px-3 py-2.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words'

/** Reconstruct the raw text with colored token spans; untokenized gaps
 *  (whitespace) render as plain text so the mirror matches the textarea exactly. */
function renderHighlighted(text: string, spans: HighlightSpan[]) {
  const out: React.ReactNode[] = []
  let last = 0
  spans.forEach((s, i) => {
    if (s.start > last) out.push(<span key={`g${i}`}>{text.slice(last, s.start)}</span>)
    const slice = text.slice(s.start, s.end)
    out.push(
      <span key={`s${i}`} className={formulaTokenClass(s.kind, slice)}>
        {slice}
      </span>
    )
    last = s.end
  })
  if (last < text.length) out.push(<span key="tail">{text.slice(last)}</span>)
  // A trailing newline has no glyph; add a zero-width space so the mirror's final
  // empty line keeps height parity with the textarea.
  if (text.endsWith('\n')) out.push(<span key="nl">{'​'}</span>)
  return out
}

/**
 * Single colored, editable formula surface (S-overhaul): a transparent
 * `<textarea>` (caret + selection + IME + paste live here) layered over a
 * pixel-aligned, syntax-colored mirror. Replaces the old read-only preview +
 * plain textarea stack. The textarea is UNCONTROLLED (cursor/IME stable); a
 * `displayText` state drives the mirror. Owns the parse status, the oversized-
 * input cap, and the syntax hint.
 */
export function ColoredFormulaEditor({ tree, onTreeChange }: ColoredFormulaEditorProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Last tree we rendered INTO the textarea — lets us detect a genuinely EXTERNAL
  // tree change (preset / builder / reset) vs. our own commit from typing.
  const lastSeededTreeRef = useRef<FilterTreeNode | null>(null)

  const initialText = useMemo(() => formulaToText(tree), [tree])
  const [displayText, setDisplayText] = useState(initialText)
  const [status, setStatus] = useState<FormulaStatus>(
    initialText.trim() ? { kind: 'ok' } : { kind: 'empty' }
  )
  const [capNotice, setCapNotice] = useState(false)

  // Skip tokenization for pathologically long input (e.g. a giant paste): the
  // mirror falls back to plain text (one node) instead of emitting tens of
  // thousands of spans. Real formulas are well under this bound.
  const spans = useMemo(
    () => (displayText.length > 5000 ? [] : lexForHighlight(displayText)),
    [displayText]
  )
  const rows = useMemo(
    () => Math.max(3, Math.min(18, displayText.split('\n').length + 1)),
    [displayText]
  )

  // Re-seed the textarea + mirror whenever the tree changes from OUTSIDE (object
  // identity differs from what we last seeded). Our own typing commits set
  // lastSeededTreeRef to the committed object first, so this is a no-op for edits
  // (no mid-typing reformat).
  useEffect(() => {
    if (tree === lastSeededTreeRef.current) return
    // An external tree change (preset / builder / reset) SUPERSEDES any half-typed
    // local edit: cancel a pending parse so a stale debounced commit can't clobber
    // the freshly-loaded tree (typing then loading a preset within the debounce).
    if (debounceRef.current) clearTimeout(debounceRef.current)
    lastSeededTreeRef.current = tree
    const text = formulaToText(tree)
    if (taRef.current) taRef.current.value = text
    setDisplayText(text)
    setStatus(text.trim() ? { kind: 'ok' } : { kind: 'empty' })
    setCapNotice(false)
  }, [tree])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Resolve debounced text → commit tree / hint / inline error (keep last valid
  // tree on error).
  const applyFormula = (text: string) => {
    const res = resolveFormulaInput(text)
    switch (res.kind) {
      case 'empty':
        lastSeededTreeRef.current = res.tree
        onTreeChange(res.tree)
        setStatus({ kind: 'empty' })
        break
      case 'ok':
        lastSeededTreeRef.current = res.tree
        onTreeChange(res.tree)
        setStatus({ kind: 'ok' })
        break
      case 'error':
        setStatus({ kind: 'error', message: res.message })
        break
      case 'cap':
        break
    }
  }

  const handleInput = (ev: React.FormEvent<HTMLTextAreaElement>) => {
    const ta = ev.currentTarget
    // Hard input cap: truncate oversized input, never feed a giant string to the
    // parser or the highlighter.
    if (ta.value.length > MAX_FORMULA_CHARS) {
      ta.value = ta.value.slice(0, MAX_FORMULA_CHARS)
      setCapNotice(true)
    } else {
      setCapNotice(false)
    }
    const text = ta.value
    setDisplayText(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => applyFormula(text), PARSE_DEBOUNCE_MS)
  }

  // Keep the colored mirror scrolled in lockstep with the textarea.
  const handleScroll = (ev: React.UIEvent<HTMLTextAreaElement>) => {
    const m = mirrorRef.current
    if (m) {
      m.scrollTop = ev.currentTarget.scrollTop
      m.scrollLeft = ev.currentTarget.scrollLeft
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-md border border-[var(--border-dim)] bg-[var(--bg-deep)] focus-within:border-[var(--neon-cyan)] focus-within:ring-[3px] focus-within:ring-[var(--neon-cyan-dim)]">
        {/* Colored mirror (behind, non-interactive). */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className={cn(
            TEXT_METRICS,
            'pointer-events-none absolute inset-0 overflow-hidden text-[var(--text-primary)]'
          )}
        >
          {renderHighlighted(displayText, spans)}
        </div>
        {/* Transparent textarea (caret + editing live here). */}
        <textarea
          ref={taRef}
          data-testid="formula-box"
          spellCheck={false}
          defaultValue={initialText}
          onInput={handleInput}
          onScroll={handleScroll}
          rows={rows}
          className={cn(
            TEXT_METRICS,
            'relative block w-full resize-y bg-transparent text-transparent caret-[var(--neon-cyan)] outline-none'
          )}
        />
      </div>

      {status.kind === 'error' ? (
        <div data-testid="formula-status" className="font-mono text-[12px] text-[var(--neon-bear)]">
          ✗ {status.message}
        </div>
      ) : status.kind === 'empty' ? (
        <div
          data-testid="formula-status"
          className="font-mono text-[12px] text-[var(--text-muted)]"
        >
          no filter — all stocks
        </div>
      ) : (
        <div data-testid="formula-status" className="font-mono text-[12px] text-[var(--neon-bull)]">
          ✓ valid query
        </div>
      )}

      {capNotice && (
        <div
          data-testid="formula-cap-notice"
          className="font-mono text-[12px] text-[var(--neon-bear)]"
        >
          ✗ Query too long — truncated to {MAX_FORMULA_CHARS.toLocaleString()} characters
        </div>
      )}

      <div className="text-[12px] text-[var(--text-muted)]">
        Type a query, e.g.{' '}
        <span className="font-mono text-[var(--text-secondary)]">
          RS 52W &gt;= 70 AND (Breakout confirmed = Yes OR Bullish RSI = Yes)
        </span>{' '}
        · use AND / OR / NOT / ( ) · signals use = Yes/No · moving averages use{' '}
        <span className="font-mono text-[var(--text-secondary)]">Price &gt;= EMA 21</span>
      </div>
    </div>
  )
}
