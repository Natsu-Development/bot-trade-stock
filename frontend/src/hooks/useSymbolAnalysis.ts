import { useState, useEffect } from 'react'
import { api, getConfigId, setConfigId, type ApiAnalysisResult } from '../lib/api'

export interface UseSymbolAnalysisResult {
  result: ApiAnalysisResult | null
  loading: boolean
  error: string | null
}

export function useSymbolAnalysis(
  symbol: string | null,
  opts: { configId?: string; interval?: string; enabled: boolean }
): UseSymbolAnalysisResult {
  const { configId, interval, enabled } = opts

  const [result, setResult] = useState<ApiAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || symbol === null) {
      setResult(null)
      setLoading(false)
      setError(null)
      return
    }

    const trimmed = symbol.trim().toUpperCase()
    if (!trimmed) {
      setResult(null)
      setLoading(false)
      setError(null)
      return
    }

    // Stale-result guard: per-effect local flag closed over by the async callback
    // and the cleanup. If symbol/enabled changes or hook unmounts before the
    // promise resolves, cleanup sets ignore=true and the resolved setState calls
    // are dropped — last-write-wins on rapid navigation.
    let ignore = false

    setLoading(true)
    setError(null)

    const resolvedConfigId = configId ?? getConfigId()
    setConfigId(resolvedConfigId)

    api
      .analyzeSymbol(trimmed, { configId: resolvedConfigId, interval })
      .then((data) => {
        if (ignore) return
        setResult(data)
      })
      .catch((err: unknown) => {
        if (ignore) return
        const msg = err instanceof Error ? err.message : 'Analysis failed'
        if (msg.includes('config')) {
          setError(`Config error: ${msg}. Please check your Config ID in Settings.`)
        } else {
          setError(msg)
        }
      })
      .finally(() => {
        if (ignore) return
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [symbol, enabled, configId, interval])

  return { result, loading, error }
}
