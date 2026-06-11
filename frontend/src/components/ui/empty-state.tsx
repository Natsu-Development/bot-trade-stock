import * as React from 'react'
import { cn } from '@/lib/utils'
import { Icons, type IconName } from '@/components/icons/Icons'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon name from the registry. Defaults to a search glyph. */
  icon?: IconName
  title: string
  description?: string
  /** Optional CTA, typically a <Button>. */
  action?: React.ReactNode
}

/**
 * Standard "nothing here" panel — for empty tables, no search results, etc.
 * Centralizes the look so empty states are consistent across pages.
 */
export function EmptyState({
  icon = 'Search',
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const IconComponent = Icons[icon]
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className
      )}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] [&_svg]:h-6 [&_svg]:w-6">
        <IconComponent />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        {description && (
          <p className="max-w-[40ch] text-xs text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
