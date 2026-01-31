import { forwardRef, HTMLAttributes } from 'react';
import { cn } from './lib/utils';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', children, ...props }, ref) => {
    const variants = {
      success: 'bg-bullish-dim text-bullish',
      danger: 'bg-bearish-dim text-bearish',
      warning: 'bg-orange-500/20 text-orange-400',
      neutral: 'bg-neutral/20 text-neutral',
    };

    return (
      <span
        ref={ref}
        className={cn('badge', variants[variant], className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
