import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-[26px] w-12 shrink-0 cursor-pointer items-center rounded-full border border-[var(--border-dim)] bg-[var(--bg-elevated)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--neon-bull)] data-[state=checked]:border-[var(--neon-bull)]',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-[18px] w-[18px] rounded-full bg-[var(--text-primary)] shadow-lg ring-0 transition-transform duration-150 data-[state=checked]:translate-x-6 data-[state=checked]:bg-[var(--bg-void)]'
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
