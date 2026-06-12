import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Loading placeholder. Compose several to mock a card/row while data loads.
 *   <Skeleton className="h-4 w-32" />
 */
function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('animate-pulse rounded-md bg-[var(--bg-elevated)]', className)} {...props} />
  )
}

export { Skeleton }
