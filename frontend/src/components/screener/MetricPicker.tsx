import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SCREENER_FIELD_OPTIONS } from '@/lib/screenerFilterOptions'
import type { FilterField } from '@/types'
import { CATEGORY_COLOR, CATEGORY_ORDER } from './filterBuilderTheme'
import { MetricOption } from './MetricOption'

// Pre-grouped once at module load so the searchable sections filter within each
// category by label, instead of re-scanning every field for every category on
// each keystroke.
const FIELDS_BY_CATEGORY = new Map(
  CATEGORY_ORDER.map(
    (cat) => [cat, SCREENER_FIELD_OPTIONS.filter((o) => o.category === cat)] as const
  )
)

interface MetricPickerProps {
  /** Remaining global capacity (50 − current leaf count). Caps selectable count. */
  remaining: number
  /** Bulk-add the chosen fields to the target group; parent clamps again defensively. */
  onDone: (fields: FilterField[]) => void
  onClose: () => void
}

/**
 * Multi-select metric popup (S6). Categorized + searchable + checkbox per metric.
 * Clamps the number of selectable metrics to `remaining` (M2): once that many are
 * checked, further checkboxes disable and an "N remaining" hint shows. "Done"
 * bulk-pushes the chosen leaves.
 *
 * Perf: the overlay deliberately does NOT use `backdrop-blur` — it renders over the
 * builder pop-up, which already dims+blurs the page, so a second full-viewport blur
 * layer just forces the GPU to re-rasterize a blur-of-a-blur on every toggle (≈40ms
 * paint latency, spiking to 60ms). A plain dim composites cheaply. Each cell is also
 * memoized so a single toggle reconciles only the changed cell, not the whole grid.
 */
export function MetricPicker({ remaining, onDone, onClose }: MetricPickerProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<FilterField>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [])

  // Escape closes (matches prototype keydown handler).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const q = query.trim().toLowerCase()
  const sections = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      fields: (FIELDS_BY_CATEGORY.get(cat) ?? []).filter((o) => o.label.toLowerCase().includes(q)),
    })).filter((s) => s.fields.length > 0)
  }, [q])

  const atCap = selected.size >= remaining
  // Stable across renders so memoized cells don't re-render from a churning handler.
  const toggle = useCallback(
    (field: FilterField) => {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(field)) {
          next.delete(field)
        } else if (next.size < remaining) {
          next.add(field)
        }
        return next
      })
    },
    [remaining]
  )

  const handleDone = () => {
    if (selected.size === 0) return
    onDone(Array.from(selected))
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center bg-black/60 pt-[7vh]"
      onClick={handleBackdrop}
      data-testid="metric-picker"
    >
      <div className="flex w-[580px] max-w-[92vw] max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-[var(--border-glow)] bg-[var(--bg-surface)] shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
        {/* Head */}
        <div className="flex items-center justify-between border-b border-[var(--border-dim)] px-4 py-3.5">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Add metrics · select all you need
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'text-[11px] font-mono',
                atCap ? 'text-[var(--neon-bear)]' : 'text-[var(--text-muted)]'
              )}
              data-testid="metric-picker-remaining"
            >
              {Math.max(0, remaining - selected.size)} remaining
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              type="button"
              aria-label="Close metric picker"
            >
              <Icons.X />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4">
          <Input
            ref={searchRef}
            startIcon={<Icons.Search />}
            inputContainerClassName="mb-2.5"
            placeholder="Search metrics…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {sections.length === 0 ? (
            <div className="px-6 py-6 text-center text-[13px] text-[var(--text-muted)]">
              No metric matches
            </div>
          ) : (
            sections.map((sec) => (
              <div key={sec.category} className="mb-3">
                <div className="my-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                  <span
                    className="inline-block h-[9px] w-[9px] flex-none rounded-full"
                    style={{ background: CATEGORY_COLOR[sec.category] }}
                  />
                  {sec.category}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sec.fields.map((f) => {
                    const on = selected.has(f.value)
                    return (
                      <MetricOption
                        key={f.value}
                        field={f.value}
                        label={f.label}
                        description={f.description}
                        accent={CATEGORY_COLOR[sec.category]}
                        on={on}
                        disabled={!on && atCap}
                        onToggle={toggle}
                      />
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Foot */}
        <div className="flex justify-end gap-2.5 border-t border-[var(--border-dim)] px-4 py-3.5">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="cyan"
            size="sm"
            onClick={handleDone}
            disabled={selected.size === 0}
            type="button"
            data-testid="metric-picker-done"
          >
            Done · add {selected.size}
          </Button>
        </div>
      </div>
    </div>
  )
}
