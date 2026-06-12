import * as React from 'react'
import { memo } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium uppercase tracking-wider',
  {
    variants: {
      variant: {
        hose: 'bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]',
        hnx: 'bg-[var(--neon-purple-dim)] text-[var(--neon-purple)]',
        upcom: 'bg-[var(--neon-amber-dim)] text-[var(--neon-amber)]',
        bull: 'bg-[var(--neon-bull-dim)] text-[var(--neon-bull)]',
        bear: 'bg-[var(--neon-bear-dim)] text-[var(--neon-bear)]',
        cyan: 'bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]',
        amber: 'bg-[var(--neon-amber-dim)] text-[var(--neon-amber)]',
        purple: 'bg-[var(--neon-purple-dim)] text-[var(--neon-purple)]',
        default:
          'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-dim)]',
        outline: 'border border-[var(--border-dim)] text-[var(--text-secondary)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = memo(function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
})

export { Badge }
