import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Icons, type IconName } from '@/components/icons/Icons'

const buttonVariants = cva(
  'inline-flex items-center gap-2 rounded-md font-display text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-cyan)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-br from-[var(--neon-bull)] to-[#00cc6a] text-[var(--bg-void)] border-none shadow-[0_4px_20px_var(--neon-bull-dim)] hover:-translate-y-px hover:shadow-[var(--neon-bull-glow)]',
        secondary:
          'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-glow)] hover:bg-[var(--bg-hover)] hover:border-[var(--neon-cyan)]',
        ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
        bear: 'bg-gradient-to-br from-[var(--neon-bear)] to-[#cc2952] text-[var(--bg-void)] border-none shadow-[0_4px_20px_var(--neon-bear-dim)] hover:-translate-y-px hover:shadow-[var(--neon-bear-glow)]',
        cyan: 'bg-gradient-to-br from-[var(--neon-cyan)] to-[#00a8cc] text-[var(--bg-void)] border-none shadow-[0_4px_20px_var(--neon-cyan-dim)] hover:-translate-y-px',
      },
      size: {
        default: 'h-10 px-5',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  icon?: IconName
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const IconComponent = icon ? Icons[icon] : null
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {IconComponent && <IconComponent className="w-[16px] h-[16px] flex-shrink-0" />}
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
