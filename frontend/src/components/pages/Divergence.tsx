import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { AnalyzePage } from '../features/AnalyzePage'
import { AnalyzeWatchlistSidebar } from '../features/AnalyzeWatchlistSidebar'
import { api, getConfigId, type ApiTradingConfig, type ApiWatchlistItem } from '../../lib/api'
import { addSymbol, removeSymbol } from '../../lib/watchlistMutations'
import { useSymbolAnalysis } from '../../hooks/useSymbolAnalysis'
import { useWatchlistQuotes } from '../../hooks/useWatchlistQuotes'

/**
 * Thin shell for the Analyze page. Owns ONLY the volatile router glue (deep-link
 * hash sync + the trigger/pending/hook-symbol dance that lets the same symbol
 * re-fire), the analyze fetch, and the watchlist config I/O. All presentation
 * lives in <AnalyzePage>; the watchlist UI lives in <AnalyzeWatchlistSidebar>.
 */
export function Divergence() {
  // Starts empty: a deep-link (/analyze?symbol=XXX) or the auto-select-first
  // effect fills it once the watchlist config arrives.
  const [symbol, setSymbol] = useState('')
  // Config ID is fixed to the default; held in state so the analyze fetch and
  // the config GET/PUT share one stable id for the session.
  const [configId] = useState(getConfigId())
  const [timeframe, setTimeframe] = useState('1D')

  // enabled gates the fetch; hookSymbol is what the hook actually fetches.
  // triggerCount + pendingSymbol allow same-symbol re-requests (hash re-nav,
  // watchlist re-click) to force a new effect run: we null hookSymbol then re-set
  // it via setTimeout so React sees two distinct values and the hook re-fires.
  const [enabled, setEnabled] = useState(false)
  const [triggerCount, setTriggerCount] = useState(0)
  const [pendingSymbol, setPendingSymbol] = useState<string | null>(null)
  const [hookSymbol, setHookSymbol] = useState<string | null>(null)

  // The full trading config (the watchlist is config.watchlist). We hold the
  // WHOLE config because the backend PUT /config validates a complete config —
  // a partial { watchlist } body is rejected (mirrors Config.tsx handleSave).
  const [config, setConfig] = useState<ApiTradingConfig | null>(null)
  const [savingWatchlist, setSavingWatchlist] = useState(false)
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  // Once the user mutates the watchlist, a late-arriving config GET (issued on
  // mount before the click) must NOT clobber the optimistic edit.
  const userEditedWatchlist = useRef(false)
  // True once a symbol has been loaded (deep-link or user action) — gates the
  // auto-select-first-watchlist-symbol effect so it only fires when nothing else has.
  const hasTriggered = useRef(false)

  const watchlist = config?.watchlist ?? []
  const inWatchlist = watchlist.some((w) => w.symbol.toUpperCase() === symbol.trim().toUpperCase())

  // Latest price / %-change / signal flags for the watchlist rows (one cached fetch).
  const { quotes } = useWatchlistQuotes()
  // The full cached symbol universe (map keys) feeds the chart symbol-search
  // autocomplete — same data source as the Config watchlist search, no extra fetch.
  const symbolOptions = useMemo(() => Array.from(quotes.keys()).sort(), [quotes])

  useEffect(() => {
    if (triggerCount === 0) return
    setHookSymbol(null)
    const id = setTimeout(() => {
      setHookSymbol(pendingSymbol)
      setEnabled(true)
    }, 0)
    return () => clearTimeout(id)
  }, [triggerCount, pendingSymbol])

  const {
    result: analysisResult,
    loading,
    error,
  } = useSymbolAnalysis(hookSymbol, {
    configId,
    interval: timeframe,
    enabled,
  })

  // Watchlist quick-switch / sidebar search: load the symbol into the chart,
  // reusing the trigger machinery so a same-symbol re-select still re-fires.
  const handleSelectSymbol = useCallback((sym: string) => {
    const upper = sym.trim().toUpperCase()
    if (!upper) return
    hasTriggered.current = true
    setSymbol(upper)
    setPendingSymbol(upper)
    setTriggerCount((n) => n + 1)
  }, [])

  // Load the full config (keyed on configId; rarely changes). A fresh config
  // resets the edit guard; the result is dropped if the user has already mutated
  // the watchlist while the request was in flight (last-write-wins on edits).
  useEffect(() => {
    let ignore = false
    userEditedWatchlist.current = false
    api
      .getConfig(configId)
      .then((cfg) => {
        if (!ignore && !userEditedWatchlist.current) setConfig(cfg)
      })
      .catch(() => {
        /* keep whatever config we have; surfaced lazily on first mutation */
      })
    return () => {
      ignore = true
    }
  }, [configId])

  // Optimistic add/remove: PUT the WHOLE config with the watchlist swapped,
  // rolling back on a failed PUT (no orphan persisted symbol).
  const persistWatchlist = useCallback(
    async (prevConfig: ApiTradingConfig, nextWatchlist: ApiWatchlistItem[]) => {
      const nextConfig = { ...prevConfig, watchlist: nextWatchlist }
      userEditedWatchlist.current = true
      setConfig(nextConfig)
      setSavingWatchlist(true)
      setWatchlistError(null)
      try {
        const updated = await api.updateConfig(configId, nextConfig)
        setConfig(updated)
      } catch (e) {
        setConfig(prevConfig) // rollback
        setWatchlistError(e instanceof Error ? e.message : 'Failed to update watchlist')
      } finally {
        setSavingWatchlist(false)
      }
    },
    [configId]
  )

  // On-chart add control: add the current symbol to the watchlist, or remove it
  // when it's already there (no-op when there's no symbol / config yet).
  const handleToggleWatchlist = useCallback(() => {
    if (!config) return
    const current = config.watchlist ?? []
    const next = inWatchlist ? removeSymbol(current, symbol) : addSymbol(current, symbol)
    if (next === current) return
    void persistWatchlist(config, next)
  }, [config, symbol, inWatchlist, persistWatchlist])

  const handleRemoveSymbol = useCallback(
    (sym: string) => {
      if (!config) return
      const current = config.watchlist ?? []
      const next = removeSymbol(current, sym)
      if (next === current) return
      void persistWatchlist(config, next)
    },
    [config, persistWatchlist]
  )

  // Deep-link: a direct visit to /analyze?symbol=XXX loads that symbol, then the
  // symbol param is stripped so it doesn't persist or re-fire on back/forward.
  useEffect(() => {
    const syncSymbolFromUrl = () => {
      const page = window.location.pathname.replace(/^\/+/, '').split(/[/?]/)[0]
      if (page !== 'analyze') return
      const params = new URLSearchParams(window.location.search)
      const fromParam = params.get('symbol')?.trim()
      if (!fromParam) return
      handleSelectSymbol(fromParam)
      params.delete('symbol')
      const qs = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    }

    syncSymbolFromUrl()
    window.addEventListener('popstate', syncSymbolFromUrl)
    return () => window.removeEventListener('popstate', syncSymbolFromUrl)
  }, [handleSelectSymbol])

  // Auto-select the FIRST watchlist symbol on entry — unless a deep-link or user
  // action already loaded one. Fires once, when the config (watchlist) first arrives.
  useEffect(() => {
    if (hasTriggered.current) return
    const first = config?.watchlist?.[0]?.symbol
    if (first) handleSelectSymbol(first)
  }, [config, handleSelectSymbol])

  return (
    <AnalyzePage
      symbol={symbol}
      timeframe={timeframe}
      analysisResult={analysisResult}
      loading={loading}
      error={error}
      onTimeframeChange={setTimeframe}
      onSubmitSymbol={handleSelectSymbol}
      symbolOptions={symbolOptions}
      inWatchlist={inWatchlist}
      onToggleWatchlist={handleToggleWatchlist}
      watchlistBusy={savingWatchlist}
      sidebar={
        <>
          <AnalyzeWatchlistSidebar
            symbols={watchlist.map((w) => w.symbol)}
            currentSymbol={symbol}
            quotes={quotes}
            onSelect={handleSelectSymbol}
            onRemove={handleRemoveSymbol}
            busy={savingWatchlist}
          />
          {watchlistError && (
            <p className="mt-2 px-1 text-[11px] text-[var(--neon-bear)]">{watchlistError}</p>
          )}
        </>
      }
    />
  )
}
