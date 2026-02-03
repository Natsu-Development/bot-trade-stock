import { cn, getRsLevel } from '../../lib/utils'
import type { RSLevel } from '../../types'

interface RSRatingProps {
  value: number
  showBar?: boolean
  className?: string
}

export function RSRating({ value, showBar = true, className = '' }: RSRatingProps) {
  const level = getRsLevel(value) as RSLevel

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {showBar && (
        <div className="w-20 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-600 ease-out',
              level === 'high' && 'bg-[var(--neon-bull)] shadow-[0_0_10px_var(--neon-bull)]',
              level === 'medium' && 'bg-[var(--neon-amber)]',
              level === 'low' && 'bg-[var(--neon-bear)]'
            )}
            style={{ width: `${value}%` }}
          />
        </div>
      )}
      <span
        className={cn(
          'font-semibold min-w-[32px]',
          level === 'high' && 'text-[var(--neon-bull)]',
          level === 'medium' && 'text-[var(--neon-amber)]',
          level === 'low' && 'text-[var(--neon-bear)]'
        )}
      >
        {value}
      </span>
    </div>
  )
}
