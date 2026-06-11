import { memo, useEffect, useRef, useState } from 'react'
import { Icons } from '../icons/Icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TableColumn } from '@/hooks/useTableColumns'

interface ColumnSelectorProps {
  columnsByCategory: Record<string, { label: string; columns: TableColumn[] }>
  visibleColumns: ReadonlySet<string>
  onToggle: (columnId: string) => void
  onReset: () => void
}

/** The Symbol column is always shown and cannot be hidden. */
const LOCKED_COLUMN = 'symbol'

/**
 * Column show/hide selector — a click-controlled popover (open on click, close on
 * outside-click / Escape, aria-haspopup/expanded). Each column is a toggle PILL
 * (the app's chip style): highlighted when shown, dim when hidden, click to toggle.
 */
export const ColumnSelector = memo(function ColumnSelector({
  columnsByCategory,
  visibleColumns,
  onToggle,
  onReset,
}: ColumnSelectorProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const visibleCount = visibleColumns.size
  const totalCount = Object.values(columnsByCategory).reduce(
    (acc, cat) => acc + cat.columns.length,
    0
  )

  // Close on outside click + Escape (listeners attached only while open).
  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant="ghost"
        className="text-xs px-3 py-1.5 h-8"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="column-selector-trigger"
      >
        <Icons.GridSmall />
        <span>Columns ({visibleCount})</span>
      </Button>

      {open && (
        <div
          data-testid="column-selector-panel"
          role="dialog"
          aria-label="Show or hide table columns"
          className="absolute right-0 top-full z-50 mt-1"
        >
          <div className="min-w-[300px] max-w-[360px] rounded-lg border border-[var(--border-dim)] bg-[var(--bg-elevated)] p-3 shadow-xl">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border-dim)] pb-2">
              <span className="text-xs font-medium text-[var(--text-primary)]">
                Show/Hide Columns
              </span>
              <button
                type="button"
                onClick={onReset}
                className="text-[10px] text-[var(--neon-cyan)] transition-colors hover:text-[var(--text-primary)]"
              >
                Reset
              </button>
            </div>

            {/* Categories — each column is a toggle pill */}
            <div className="max-h-[420px] space-y-3 overflow-y-auto">
              {Object.entries(columnsByCategory).map(([key, { label, columns }]) => (
                <div key={key}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {columns.map((col) => {
                      const locked = col.id === LOCKED_COLUMN
                      const visible = visibleColumns.has(col.id)
                      return (
                        <button
                          key={col.id}
                          type="button"
                          data-testid={`column-pill-${col.id}`}
                          aria-pressed={visible}
                          // Locked uses aria-disabled (not the `disabled` attribute) so the
                          // pill stays focusable + announced to screen readers; the onClick
                          // guard below is what actually blocks the toggle.
                          aria-disabled={locked || undefined}
                          aria-label={locked ? `${col.label} (always shown)` : undefined}
                          title={locked ? 'Always shown' : undefined}
                          onClick={locked ? undefined : () => onToggle(col.id)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150',
                            locked
                              ? 'cursor-not-allowed border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)] opacity-70'
                              : visible
                                ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]'
                                : 'border-[var(--border-dim)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:-translate-y-px hover:border-[var(--border-glow)] hover:text-[var(--text-primary)]'
                          )}
                        >
                          {col.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-3 border-t border-[var(--border-dim)] pt-2 text-[10px] text-[var(--text-muted)]">
              {visibleCount} of {totalCount} columns visible
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
