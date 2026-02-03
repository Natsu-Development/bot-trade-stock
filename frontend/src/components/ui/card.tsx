import * as React from 'react'
import { cn } from '@/lib/utils'

const CardRoot = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg overflow-hidden transition-all duration-300 hover:border-[var(--border-glow)]',
      className
    )}
    {...props}
  />
))
CardRoot.displayName = 'Card'

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { action?: React.ReactNode }
>(({ className, action, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-5 py-4 border-b border-[var(--border-dim)] flex justify-between items-center',
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-2.5 [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:text-[var(--neon-cyan)] [&_svg]:flex-shrink-0">
      {children}
    </div>
    {action && <div className="flex items-center gap-2 [&_svg]:w-[16px] [&_svg]:h-[16px] [&_svg]:flex-shrink-0">{action}</div>}
  </div>
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm text-[var(--text-muted)]', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-5 py-5', className)} {...props} />
))
CardBody.displayName = 'CardBody'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
))
CardFooter.displayName = 'CardFooter'

const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
  Footer: CardFooter,
})

export { Card, CardHeader, CardTitle, CardDescription, CardBody, CardContent, CardFooter }
