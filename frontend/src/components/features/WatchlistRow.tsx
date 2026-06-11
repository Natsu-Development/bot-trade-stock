import { memo, useCallback } from 'react'
import { Icons } from '../icons/Icons'
import { cn } from '@/lib/utils'
import { Badge } from '../ui/badge'
import type { ApiWatchlistItem } from '@/lib/api'
import { countActiveConditions, isWatchlistItemActive } from '@/lib/watchlistOptions'
import { WatchlistStatusBadge } from './WatchlistStatusBadge'
import { WatchlistCategoryChips } from './WatchlistCategoryChips'

interface WatchlistRowProps {
  item: ApiWatchlistItem
  index: number
  expanded: boolean
  panelId: string
  onToggle: (symbol: string) => void
  onEdit: (index: number) => void
  onDelete: (index: number) => void | Promise<void>
}

/**
 * Collapsed single-line summary row, laid out on the shared `.watchlist-row-grid`
 * fixed column tracks: CHEVRON | SYMBOL | STATUS | WATCHING | ON/TOTAL | ACTIONS.
 * The WATCHING cell clips (never wraps) so every row is exactly one line tall.
 */
export const WatchlistRow = memo(function WatchlistRow({
  item,
  index,
  expanded,
  panelId,
  onToggle,
  onEdit,
  onDelete,
}: WatchlistRowProps) {
  const handleEdit = useCallback(() => onEdit(index), [index, onEdit])
  const handleDelete = useCallback(() => onDelete(index), [index, onDelete])
  const handleToggle = useCallback(() => onToggle(item.symbol), [item.symbol, onToggle])

  const active = isWatchlistItemActive(item)
  const { active: activeCount, total } = countActiveConditions(item)
  const paused = !active

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-controls={panelId}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} conditions for ${item.symbol}`}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleToggle()
        }
      }}
      className={cn(
        'watchlist-row-grid px-3 py-2 cursor-pointer transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--neon-cyan)]',
        !active && 'opacity-65'
      )}
    >
      {/* CHEVRON — visual indicator only; the whole row toggles (like the preset cards) */}
      <span
        aria-hidden="true"
        className={cn(
          'flex h-7 w-7 items-center justify-center justify-self-center text-[var(--text-muted)] transition-transform duration-150 motion-reduce:transition-none [&_svg]:h-4 [&_svg]:w-4',
          expanded && 'rotate-90'
        )}
      >
        <Icons.ChevronRight />
      </span>

      {/* SYMBOL */}
      <Badge variant="cyan" className="font-mono justify-self-start">
        {item.symbol}
      </Badge>

      {/* STATUS */}
      <WatchlistStatusBadge paused={paused} />

      {/* WATCHING */}
      <WatchlistCategoryChips item={item} />

      {/* ON/TOTAL */}
      <span
        className={cn(
          'text-[11px] font-mono tabular-nums whitespace-nowrap',
          paused ? 'text-[var(--neon-amber)]' : 'text-[var(--text-secondary)]'
        )}
      >
        {activeCount}/{total}
      </span>

      {/* ACTIONS */}
      <div className="flex items-center justify-self-end gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleEdit()
          }}
          aria-label={`Edit watchlist entry for ${item.symbol}`}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-cyan)] transition-colors duration-150 [&_svg]:w-3.5 [&_svg]:h-3.5"
        >
          <Icons.Settings2 />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleDelete()
          }}
          aria-label={`Remove watchlist entry for ${item.symbol}`}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-bear)] transition-colors duration-150 [&_svg]:w-3.5 [&_svg]:h-3.5"
        >
          <Icons.Trash2 />
        </button>
      </div>
    </div>
  )
})
