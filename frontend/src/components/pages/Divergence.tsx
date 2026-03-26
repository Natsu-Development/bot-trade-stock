import { useState, useMemo, useCallback } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '../icons/Icons'
import { SignalCard } from '../features/SignalCard'
import { PriceChart } from '../features/PriceChart'
import { api, setConfigId, getConfigId, isSignalConfirmed, isSignalPotential, type ApiAnalysisResult, type ApiDivergence } from '../../lib/api'

const CONFIDENCE_HIGH = 85 // Confidence % assigned when a divergence is confirmed

type SignalType = 'all' | 'breakdown' | 'breakout' | 'confirmed' | 'watching'

const SIGNAL_TYPE_OPTIONS: { value: SignalType; label: string; color: string }[] = [
  { value: 'all', label: 'All Signals', color: 'cyan' },
  { value: 'breakdown', label: 'Breakdown', color: 'rose' },
  { value: 'breakout', label: 'Breakout', color: 'emerald' },
  { value: 'confirmed', label: 'Confirmed', color: 'cyan' },
  { value: 'watching', label: 'Watching', color: 'amber' },
]

export function Divergence() {
  const [symbol, setSymbol] = useState('FPT')
  const [configId, setConfigIdInput] = useState(getConfigId())
  const [timeframe, setTimeframe] = useState('1D')
  const [signalType, setSignalType] = useState<SignalType>('all')
  const [loading, setLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<ApiAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyzeAll = useCallback(async () => {
    if (!symbol.trim()) {
      setError('Please enter a symbol')
      return
    }

    setLoading(true)
    setError(null)

    try {
      setConfigId(configId)
      const result = await api.analyzeSymbol(
        symbol.toUpperCase(),
        { configId, interval: timeframe }
      )
      setAnalysisResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      setError(msg)
      if (msg.includes('config')) {
        setError(`Config error: ${msg}. Please check your Config ID in Settings.`)
      }
    } finally {
      setLoading(false)
    }
  }, [symbol, configId, timeframe])

  // Extract signal data from analysis result - memoized to prevent unnecessary re-renders
  const filteredSignals = useMemo(() => {
    if (!analysisResult?.signals) return []
    return analysisResult.signals.filter(s => {
      if (signalType === 'all') return true
      if (signalType === 'breakdown') return s.type.includes('breakdown')
      if (signalType === 'breakout') return s.type.includes('breakout')
      if (signalType === 'confirmed') return isSignalConfirmed(s)
      if (signalType === 'watching') return isSignalPotential(s)
      return true
    })
  }, [analysisResult?.signals, signalType])

  // Extract divergences from combined array, filter by type
  const bullishDivergences = useMemo(() => {
    return analysisResult?.divergences?.filter((d: ApiDivergence) => d.type === 'bullish') || []
  }, [analysisResult?.divergences])

  const bearishDivergences = useMemo(() => {
    return analysisResult?.divergences?.filter((d: ApiDivergence) => d.type === 'bearish') || []
  }, [analysisResult?.divergences])

  // Memoize trendlines from the API response with pre-calculated data points
  const trendlines = useMemo(() => {
    return analysisResult?.trendlines || []
  }, [analysisResult?.trendlines])

  const bullishCount = bullishDivergences.length
  const bearishCount = bearishDivergences.length

  // Get divergence signal data for SignalCard
  const getDivergenceSignal = (divergences: ApiDivergence[]) => {
    if (!divergences.length) return null
    const latest = divergences[0]  // Most recent divergence
    return {
      confidence: latest.is_early ? 50 : CONFIDENCE_HIGH,
      divergenceType: latest.type,
      strength: latest.is_early ? 'Early' : 'High',
      points: latest.divergence_points,
    }
  }

  const bullishSignal = getDivergenceSignal(bullishDivergences)
  const bearishSignal = getDivergenceSignal(bearishDivergences)

  return (
    <div className="animate-slide-in-from-bottom">
      <Header
        title="Divergence Analysis"
        subtitle="RSI divergence & trendline pattern detection"
        actions={
          <Button variant="secondary" icon="Clock">
            <span>History</span>
          </Button>
        }
      />

      <Card className="mb-6">
        <Card.Header>
          <Icons.Search />
          <span>Analyze Symbol</span>
        </Card.Header>
        <Card.Body>
          <div className="config-grid !mb-4">
            <div className="form-group !mb-0">
              <label className="form-label">Config ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., default"
                value={configId}
                onChange={(e) => setConfigIdInput(e.target.value)}
              />
            </div>
          </div>
          <div className="grid-3 items-end">
            <div className="form-group !mb-0">
              <label className="form-label">Symbol</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., VCB"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              />
            </div>
            <div className="form-group !mb-0">
              <label className="form-label">Timeframe</label>
              <select
                className="form-input form-select"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              >
                <option value="1D">Daily (1D)</option>
                <option value="1W">Weekly (1W)</option>
                <option value="1M">Monthly (1M)</option>
              </select>
            </div>
            <Button
              className="w-full"
              variant="primary"
              icon="Search"
              onClick={handleAnalyzeAll}
              disabled={loading}
            >
              <span>{loading ? 'Analyzing...' : 'Analyze All'}</span>
            </Button>
          </div>

          {/* Signal Type Selector */}
          <div className="flex items-center gap-3 mt-4">
            <span className="text-sm text-[var(--text-muted)]">Signal Type:</span>
            <div className="flex gap-2 flex-wrap">
              {SIGNAL_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSignalType(option.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    signalType === option.value
                      ? `bg-[var(--neon-${option.color})] text-black`
                      : 'bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="text-[var(--neon-bear)] mt-3 text-[13px]">
              {error}
            </div>
          )}
        </Card.Body>
      </Card>

      <div className="grid-2 mb-6">
        {bullishSignal ? (
          <SignalCard
            type="bullish"
            title="Bullish Divergence"
            value={bullishSignal.confidence > 50 ? 'BUY' : 'HOLD'}
            confidence={bullishSignal.confidence}
            divergenceType={bullishSignal.divergenceType}
            strength={bullishSignal.strength}
            points={bullishSignal.points}
          />
        ) : (
          <SignalCard
            type="bullish"
            title="Bullish Divergence"
            value="HOLD"
            confidence={0}
            divergenceType="N/A"
            strength="None"
          />
        )}
        {bearishSignal ? (
          <SignalCard
            type="bearish"
            title="Bearish Divergence"
            value={bearishSignal.confidence > 50 ? 'SELL' : 'HOLD'}
            confidence={bearishSignal.confidence}
            divergenceType={bearishSignal.divergenceType}
            strength={bearishSignal.strength}
            points={bearishSignal.points}
          />
        ) : (
          <SignalCard
            type="bearish"
            title="Bearish Divergence"
            value="HOLD"
            confidence={0}
            divergenceType="N/A"
            strength="None"
          />
        )}
      </div>

      <Card>
        <Card.Header
          action={
            <div className="flex gap-2 items-center">
              <Badge variant="bull">{String(bullishCount)} Bullish</Badge>
              <Badge variant="bear">{String(bearishCount)} Bearish</Badge>
              {analysisResult && (
                <Badge variant="cyan">
                  {SIGNAL_TYPE_OPTIONS.find(opt => opt.value === signalType)?.label || 'All'}: {filteredSignals.length}
                </Badge>
              )}
            </div>
          }
        >
          <Icons.Chart />
          <span>Price & Trendline Chart — {symbol || 'Select a symbol'}</span>
        </Card.Header>
        <Card.Body>
          {analysisResult && analysisResult.price_history.length > 0 ? (
            <PriceChart
              symbol={symbol || 'FPT'}
              priceHistory={analysisResult.price_history}
              trendlines={trendlines}
              signals={filteredSignals}
              analysisSignals={analysisResult.signals}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-[var(--text-muted)]">
              <Icons.Chart className="w-12 h-12 mb-3" />
              <span className="text-sm">
                {analysisResult ? 'No price data available' : 'Click "Analyze All" to load chart with divergences and trendlines'}
              </span>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
