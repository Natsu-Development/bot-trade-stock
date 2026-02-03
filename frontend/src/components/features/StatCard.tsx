import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import type { StatCard as StatCardType } from '../../types'

interface StatCardProps extends StatCardType {
  icon?: (props: SVGProps<SVGSVGElement>) => JSX.Element
}

export function StatCard({
  label,
  value,
  change,
  variant = 'default',
  icon = Icons.Database
}: StatCardProps) {
  const IconComponent = icon

  return (
    <div
      className={cn(
        'relative overflow-hidden p-5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-dim)]',
        'animate-[stat-card-in_0.6s_ease-out_backwards]',
        // Top border gradient on hover
        'before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:opacity-0 before:transition-opacity before:duration-300',
        'hover:before:opacity-100',
        variant === 'default' && 'before:bg-gradient-to-r before:from-transparent before:via-[var(--neon-cyan)] before:to-transparent',
        variant === 'bullish' && 'before:bg-gradient-to-r before:from-transparent before:via-[var(--neon-bull)] before:to-transparent',
        variant === 'bearish' && 'before:bg-gradient-to-r before:from-transparent before:via-[var(--neon-bear)] before:to-transparent'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-md flex items-center justify-center mb-4 bg-[var(--bg-elevated)]',
          '[&_svg]:w-5 [&_svg]:h-5 [&_svg]:flex-shrink-0',
          variant === 'default' && '[&_svg]:text-[var(--neon-cyan)]',
          variant === 'bullish' && '[&_svg]:text-[var(--neon-bull)]',
          variant === 'bearish' && '[&_svg]:text-[var(--neon-bear)]'
        )}
      >
        <IconComponent />
      </div>

      {/* Label */}
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>

      {/* Value */}
      <p className="font-mono text-[28px] font-semibold text-[var(--text-primary)]">{value}</p>

      {/* Change Badge */}
      {change && (
        <span
          className={cn(
            'inline-flex items-center gap-1 font-mono text-xs mt-2 px-2 py-0.5 rounded-sm',
            (change.startsWith('+') || change.startsWith('↑'))
              ? 'text-[var(--neon-bull)] bg-[var(--neon-bull-dim)]'
              : change.startsWith('-') || change.startsWith('↓')
                ? 'text-[var(--neon-bear)] bg-[var(--neon-bear-dim)]'
                : 'text-[var(--neon-cyan)] bg-[var(--neon-cyan-dim)]'
          )}
        >
          {change}
        </span>
      )}
    </div>
  )
}
