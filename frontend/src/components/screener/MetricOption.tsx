import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { FilterField } from '@/types'

interface MetricOptionProps {
  field: FilterField
  label: string
  description?: string
  /** Category accent color (CATEGORY_COLOR[category]); shown as a left border band. */
  accent?: string
  on: boolean
  disabled: boolean
  onToggle: (field: FilterField) => void
}

/**
 * One selectable metric in the metric picker. Shows the metric NAME and its
 * DESCRIPTION on a clean two-line layout — previously the description was hidden
 * behind a native `title=` tooltip on a tiny info icon and the label truncated, which
 * read poorly. A category-colored left band ties each option to its group.
 *
 * Memoized so toggling one metric re-renders only the changed option. Deliberately
 * free of `transition-colors` so hovering across the grid stays smooth on slow CPUs
 * (the color tween otherwise fires on every pointer move between options).
 */
export const MetricOption = memo(function MetricOption({
  field,
  label,
  description,
  accent,
  on,
  disabled,
  onToggle,
}: MetricOptionProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onToggle(field)}
      data-field={field}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-lg border border-l-2 px-3 py-2.5 text-left',
        'border-[var(--border-dim)] bg-[var(--bg-elevated)]',
        'hover:border-[var(--neon-cyan)]',
        on && 'border-[var(--neon-cyan)] bg-[var(--neon-cyan-dim)]',
        disabled && 'cursor-not-allowed opacity-40'
      )}
      // Category accent on the left band only while unchecked; the checked state
      // recolors the whole border to neon-cyan.
      style={!on && accent ? { borderLeftColor: accent } : undefined}
    >
      {/* Themed checkbox square — lightweight on purpose (a Radix checkbox per cell
          reintroduces the cross-cell hover lag this picker was tuned to avoid). */}
      <span
        aria-hidden="true"
        className={cn(
          'mt-px grid h-4 w-4 flex-none place-items-center rounded-[4px] border',
          on
            ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)] text-[var(--bg-void)]'
            : 'border-[var(--border-dim)] bg-[var(--bg-surface)] text-transparent'
        )}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 6.2l2.2 2.3 4.8-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {/* Name + description, both visible. */}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[12.5px] font-semibold leading-tight',
            on ? 'text-[var(--neon-cyan)]' : 'text-[var(--text-primary)]'
          )}
        >
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-muted)]">
            {description}
          </span>
        )}
      </span>
    </button>
  )
})
