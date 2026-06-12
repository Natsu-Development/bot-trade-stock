import { useState, useEffect } from 'react'
import { api } from '../lib/api'

/** Company name + latest price + % change for one symbol, distilled from the
 *  cached /stocks/filter feed (the same data the Dashboard/Screener render). */
export interface WatchlistQuote {
  /** Company name (may be empty when the backend has none). */
  name: string
  price: number
  /** Percent change; the absolute change is derived from price + this. */
  change: number
}

export interface UseWatchlistQuotesResult {
  /** Keyed by UPPER-CASE symbol. Empty until the fetch resolves (or on failure). */
  quotes: Map<string, WatchlistQuote>
  loading: boolean
}

/**
 * Fetches the full cached stock metrics once and indexes them by symbol so the
 * watchlist sidebar can show price / %-change / signal dots without an
 * (expensive) analyze call per row. Symbols already in the backend cache at
 * page-load time are covered; a brand-new symbol added mid-session shows an
 * em-dash until the next page load. A failed or empty fetch leaves the map empty
 * (rows degrade to an em-dash) and never throws to the page.
 */
export function useWatchlistQuotes(): UseWatchlistQuotesResult {
  const [quotes, setQuotes] = useState<Map<string, WatchlistQuote>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    api
      .filterStocks({ match: 'and', conditions: [] })
      .then((res) => {
        if (ignore) return
        const map = new Map<string, WatchlistQuote>()
        for (const s of res.stocks) {
          map.set(s.symbol.toUpperCase(), {
            name: s.name ?? '',
            price: s.current_price,
            change: s.price_change_pct,
          })
        }
        setQuotes(map)
      })
      .catch(() => {
        /* leave the map empty — rows render an em-dash instead of crashing */
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  return { quotes, loading }
}
