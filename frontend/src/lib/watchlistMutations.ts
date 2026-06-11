import type { ApiWatchlistItem } from './api'

/**
 * Seed condition for a symbol added from the Analyze page. The backend's
 * WatchlistItem.Validate() REJECTS empty `conditions`, so a watch-only entry
 * must carry at least one condition. A DISABLED bullish_divergence passes
 * validation: disabled conditions skip threshold/reference checks, and
 * divergence types never require a threshold. It fires nothing while disabled.
 */
function seedCondition(): ApiWatchlistItem['conditions'][number] {
  return { type: 'bullish_divergence', threshold: 0, enabled: false }
}

const norm = (symbol: string) => symbol.trim().toUpperCase()

/** True when `symbol` is already in the watchlist (case-insensitive). */
export function hasSymbol(watchlist: ApiWatchlistItem[], symbol: string): boolean {
  const s = norm(symbol)
  return watchlist.some((w) => norm(w.symbol) === s)
}

/**
 * Add `symbol` to the watchlist with a single disabled seed condition.
 * Idempotent (no-op if already present) and case-normalized. Empty input is a no-op.
 */
export function addSymbol(watchlist: ApiWatchlistItem[], symbol: string): ApiWatchlistItem[] {
  const s = norm(symbol)
  if (!s) return watchlist
  if (hasSymbol(watchlist, s)) return watchlist
  return [...watchlist, { symbol: s, conditions: [seedCondition()] }]
}

/**
 * Remove `symbol` from the watchlist (case-insensitive). Idempotent.
 */
export function removeSymbol(watchlist: ApiWatchlistItem[], symbol: string): ApiWatchlistItem[] {
  const s = norm(symbol)
  if (!s) return watchlist
  return watchlist.filter((w) => norm(w.symbol) !== s)
}
