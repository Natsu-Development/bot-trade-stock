import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium uppercase tracking-wider',
  {
    variants: {
      variant: {
        hose: 'bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]',
        hnx: 'bg-[rgba(153,102,255,0.13)] text-[var(--neon-purple)]',
        upcom: 'bg-[rgba(255,170,0,0.13)] text-[var(--neon-amber)]',
        bull: 'bg-[var(--neon-bull-dim)] text-[var(--neon-bull)]',
        bear: 'bg-[var(--neon-bear-dim)] text-[var(--neon-bear)]',
        cyan: 'bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]',
        amber: 'bg-[rgba(255,170,0,0.13)] text-[var(--neon-amber)]',
        purple: 'bg-[rgba(153,102,255,0.13)] text-[var(--neon-purple)]',
        default: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-dim)]',
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

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
