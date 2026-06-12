import { memo, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import { Badge } from '../ui/badge'
import { apiNodeToTree } from '@/lib/filterSerialize'
import { FilterFormula } from '../screener/FilterFormula'
import { countLeaves } from '@/lib/filterTreeOps'
import type { ScreenerFilterPreset } from '@/lib/api'

interface FilterPresetCardProps {
  preset: ScreenerFilterPreset
  onEdit: (preset: ScreenerFilterPreset) => void
  onDelete: (name: string) => void
}

/**
 * Config-page saved-preset card (R6). Collapsed by default: the header (chevron +
 * name + condition count + edit/delete) is always shown; the pretty filter
 * formula and exchanges reveal on expand. Editing opens the shared Query Builder.
 */
export const FilterPresetCard = memo(function FilterPresetCard({
  preset,
  onEdit,
  onDelete,
}: FilterPresetCardProps) {
  // Hydrate the flat preset tree once, then derive both the pretty formula and the
  // leaf count from it (one parse per preset change, not two).
  const { tree, leafCount } = useMemo(() => {
    const tree = apiNodeToTree(preset)
    return { tree, leafCount: countLeaves(tree) }
  }, [preset])
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-elevated)] transition-all duration-200 hover:border-[var(--border-glow)]">
      {/* Header (always visible) — the chevron+name region toggles collapse. */}
      <div className="flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Icons.ChevronRight
            className={cn(
              'h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-150',
              expanded && 'rotate-90'
            )}
          />
          <h4 className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {preset.name}
          </h4>
          <Badge variant="cyan" className="flex-shrink-0">
            {leafCount} {leafCount === 1 ? 'condition' : 'conditions'}
          </Badge>
        </button>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            className="rounded p-1.5 text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--neon-cyan)]"
            onClick={() => onEdit(preset)}
            type="button"
            aria-label="Edit preset"
          >
            <Icons.Settings2 className="h-4 w-4" />
          </button>
          <button
            className="rounded p-1.5 text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--neon-bear)]"
            onClick={() => onDelete(preset.name)}
            type="button"
            aria-label="Delete preset"
          >
            <Icons.Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Preset formula (rendered from {root}) */}
          <div
            className="mb-3 rounded-md border border-[var(--border-dim)] border-l-[3px] border-l-[var(--neon-bull)] bg-[var(--bg-deep)] px-3 py-2"
            data-testid="preset-formula"
          >
            <FilterFormula root={tree} />
          </div>

          {/* Exchanges */}
          {preset.exchanges && preset.exchanges.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--text-muted)]">Exchanges:</span>
              <div className="flex gap-1">
                {preset.exchanges.map((exchange) => (
                  <Badge key={exchange} variant="outline">
                    {exchange}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
