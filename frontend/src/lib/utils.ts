import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { RSLevel } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRsLevel(value: number): RSLevel {
  if (value >= 80) return 'high'
  if (value >= 60) return 'medium'
  return 'low'
}

export function getBadgeVariantFromExchange(exchange: string): 'hose' | 'hnx' | 'upcom' {
  const upper = exchange.toUpperCase()
  if (upper === 'HOSE') return 'hose'
  if (upper === 'HNX') return 'hnx'
  return 'upcom'
}

export function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}
