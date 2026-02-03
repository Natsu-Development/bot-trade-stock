import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { BadgeVariant, RSLevel } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRsLevel(value: number): RSLevel {
  if (value >= 80) return 'high'
  if (value >= 60) return 'medium'
  return 'low'
}

export function getRsColor(level: RSLevel): string {
  switch (level) {
    case 'high':
      return 'var(--neon-bull)'
    case 'medium':
      return 'var(--neon-amber)'
    case 'low':
      return 'var(--neon-bear)'
  }
}

export function getBadgeVariant(exchange: string): BadgeVariant {
  const upper = exchange.toUpperCase()
  if (upper === 'HOSE') return 'hose'
  if (upper === 'HNX') return 'hnx'
  if (upper === 'UPCOM') return 'upcom'
  return 'hose'
}

export function getBadgeVariantFromExchange(exchange: string): BadgeVariant {
  const upper = exchange.toUpperCase()
  if (upper === 'HOSE') return 'hose'
  if (upper === 'HNX') return 'hnx'
  if (upper === 'UPCOM') return 'upcom'
  return 'hose'
}

export function formatPrice(price: number): string {
  return price.toLocaleString('en-US')
}

export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

export function formatVolume(volume: number): string {
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
  return volume.toString()
}
