import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  inputContainerClassName?: string
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, inputContainerClassName, startIcon, endIcon, ...props }, ref) => {
    const id = React.useId()
    return (
      <div className={inputContainerClassName || (label && 'mb-4')}>
        {label && (
          <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          {startIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
              {startIcon}
            </div>
          )}
          <input
            id={id}
            type={type}
            className={cn(
              'flex h-10 w-full rounded-md border border-[var(--border-dim)] bg-[var(--bg-elevated)] px-4 py-2',
              'text-sm text-[var(--text-primary)] font-mono shadow-sm transition-colors',
              'placeholder:text-[var(--text-muted)]',
              'focus-visible:outline-none focus-visible:border-[var(--neon-cyan)]',
              'focus-visible:ring-[3px] focus-visible:ring-[var(--neon-cyan-dim)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              startIcon && 'pl-11',
              endIcon && 'pr-11',
              className
            )}
            ref={ref}
            {...props}
          />
          {endIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
              {endIcon}
            </div>
          )}
        </div>
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
