import { cn } from '@/lib/utils'
import type { ScreenerFilterPreset } from '@/lib/api'
import type { LoadedPreset } from '@/hooks/screener/useScreenerFilters'

interface SavedFilterChipsProps {
  /** User-saved presets (config.metrics_filter). */
  savedFilters: ScreenerFilterPreset[]
  /** Provenance of the active filter — drives the active-chip highlight. */
  loadedPreset: LoadedPreset | null
  /** The live tree diverges from the loaded preset's baseline (drives the dot). */
  isModified: boolean
  /** Load a saved preset by name (click a chip). */
  onLoad: (name: string) => void
  /** Delete a saved preset by name. Omit for a compact, load-only quick-pick. */
  onDelete?: (name: string) => void
}

/**
 * The user's saved-filter chips: one click-to-load chip per saved preset, with an
 * optional ✕ delete. Shared by the Screener's collapsed-header quick-pick (load-only)
 * and FilterBar's expanded "Saved Filters" section (load + delete). Name-only — saved
 * filters carry no description.
 */
export function SavedFilterChips({
  savedFilters,
  loadedPreset,
  isModified,
  onLoad,
  onDelete,
}: SavedFilterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {savedFilters.map((f) => {
        const active = loadedPreset?.source === 'saved' && loadedPreset.name === f.name
        return (
          <div
            key={f.name}
            data-testid="saved-filter-chip"
            data-active={active ? 'true' : undefined}
            className={cn(
              'inline-flex items-center rounded-full border text-[13px] font-medium transition-all duration-200',
              active
                ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]'
                : 'border-[var(--border-dim)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-glow)]'
            )}
          >
            <button
              type="button"
              onClick={() => onLoad(f.name)}
              className={cn('py-1.5 pl-3.5', onDelete ? 'pr-2' : 'pr-3.5')}
              title={`Load “${f.name}”`}
            >
              {active && isModified && (
                <span
                  aria-hidden="true"
                  title="Modified"
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--neon-amber)] align-middle"
                />
              )}
              {f.name}
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(f.name)}
                aria-label={`Delete ${f.name}`}
                title={`Delete “${f.name}”`}
                className="grid h-7 w-7 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--neon-bear)]"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
