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
    maximumFractionDigits: 2,
  })
}

/**
 * Format a timestamp as `DD/MM/YYYY, h:mm:ss AM/PM` (day-first date, 12-hour time).
 *
 * Built manually from LOCAL Date components rather than via toLocaleString, for
 * two reasons: (1) the default toLocaleString uses the US M/D/YYYY order, which is
 * what we are correcting away from; (2) Node/ICU >= 18 inserts a narrow no-break
 * space (U+202F) before AM/PM in toLocaleTimeString('en-US'), which silently
 * breaks exact-match tests and copy. Reading local components preserves the same
 * wall-clock the user already sees (e.g. ICT). Returns '' for an invalid date.
 */
export function formatTimestamp(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''

  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()

  const hours24 = d.getHours()
  const ampm = hours24 < 12 ? 'AM' : 'PM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const min = String(d.getMinutes()).padStart(2, '0')
  const sec = String(d.getSeconds()).padStart(2, '0')

  return `${dd}/${mm}/${yyyy}, ${hours12}:${min}:${sec} ${ampm}`
}
