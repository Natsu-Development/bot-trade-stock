import { ReactNode } from 'react'
import type { BadgeVariant } from '../../types'
import './Badge.css'

interface BadgeProps {
  variant: BadgeVariant
  children: ReactNode
}

export function Badge({ variant, children }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}
