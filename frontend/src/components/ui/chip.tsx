import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const chipVariants = cva(
  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer border',
  {
    variants: {
      variant: {
        default: 'bg-[var(--bg-elevated)] border border-[var(--border-dim)] text-[var(--text-secondary)] hover:border-[var(--neon-cyan)] hover:text-[var(--text-primary)]',
        active: 'bg-[var(--neon-cyan-dim)] border border-[var(--neon-cyan)] text-[var(--neon-cyan)]',
        bull: 'bg-[var(--neon-bull-dim)] border border-[var(--neon-bull)] text-[var(--neon-bull)]',
        bear: 'bg-[var(--neon-bear-dim)] border border-[var(--neon-bear)] text-[var(--neon-bear)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {}

function Chip({ className, variant, ...props }: ChipProps) {
  return (
    <button
      className={cn(chipVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Chip, chipVariants }
