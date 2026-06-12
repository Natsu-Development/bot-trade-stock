import type { FilterFieldOption } from '@/types'

/**
 * Shared visual vocabulary for the Query Builder (S6), ported from the prototype
 * CATS / group[data-depth] color bands. Categories map to the FilterFieldOption
 * `category` union; colors reuse the neon theme CSS variables in global.css.
 */

export type FilterCategory = FilterFieldOption['category']

/** Display order of categories in the metric picker / field selects. */
export const CATEGORY_ORDER: FilterCategory[] = [
  'RS Rating',
  'Volume',
  'Price',
  'Moving Avg',
  'Signal',
]

/** Category → dot color (prototype: rs=cyan, vol=purple, price=green/bull, ma=amber, sig=bear). */
export const CATEGORY_COLOR: Record<FilterCategory, string> = {
  'RS Rating': 'var(--neon-cyan)',
  Volume: 'var(--neon-purple)',
  Price: 'var(--neon-bull)',
  'Moving Avg': 'var(--neon-amber)',
  Signal: 'var(--neon-bear)',
}

/** Per-depth left-border band color (prototype group[data-depth] 1/2/3). */
export const DEPTH_BAND_COLOR: Record<number, string> = {
  1: 'var(--neon-cyan)',
  2: 'var(--neon-purple)',
  3: 'var(--neon-amber)',
}

/** Band color for a depth, clamped to the last band for any deeper level. */
export function depthBandColor(depth: number): string {
  return DEPTH_BAND_COLOR[depth] ?? DEPTH_BAND_COLOR[3]
}
