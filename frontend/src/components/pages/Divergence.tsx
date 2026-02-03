import { useState } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '../icons/Icons'
import { SignalCard } from '../features/SignalCard'
import { ChartPlaceholder } from '../features/ChartPlaceholder'
import { api, setConfigId, getConfigId, type ApiDivergenceResult } from '../../lib/api'

export function Divergence() {
  const [symbol, setSymbol] = useState('FPT')
  const [configId, setConfigIdInput] = useState(getConfigId())
  const [timeframe, setTimeframe] = useState('1D')
  const [loading, setLoading] = useState(false)
  const [bullishResult, setBullishResult] = useState<ApiDivergenceResult | null>(null)
  const [bearishResult, setBearishResult] = useState<ApiDivergenceResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async (type: 'bullish' | 'bearish') => {
    if (!symbol.trim()) {
      setError('Please enter a symbol')
      return
    }

    setLoading(true)
    setError(null)

    try {
      setConfigId(configId)
      const result = type === 'bullish'
        ? await api.analyzeBullishDivergence(symbol.toUpperCase(), configId)
        : await api.analyzeBearishDivergence(symbol.toUpperCase(), configId)

      if (type === 'bullish') {
        setBullishResult(result)
      } else {
        setBearishResult(result)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      setError(msg)
      if (msg.includes('config')) {
        setError(`Config error: ${msg}. Please check your Config ID in Settings.`)
      }
    } finally {
      setLoading(false)
    }
  }

  const bullishCount = bullishResult?.divergence?.divergence_found ? 1 : 0
  const bearishCount = bearishResult?.divergence?.divergence_found ? 1 : 0

  const getBullishSignal = () => {
    if (!bullishResult) return null
    const { divergence } = bullishResult
    return {
      currentRsi: divergence.current_rsi,
      confidence: divergence.divergence_found ? 85 : 10,
      divergenceType: divergence.type || 'N/A',
      strength: divergence.divergence_found ? 'High' : 'None',
    }
  }

  const getBearishSignal = () => {
    if (!bearishResult) return null
    const { divergence } = bearishResult
    return {
      currentRsi: divergence.current_rsi,
      confidence: divergence.divergence_found ? 85 : 10,
      divergenceType: divergence.type || 'N/A',
      strength: divergence.divergence_found ? 'High' : 'None',
    }
  }

  const bullishSignal = getBullishSignal()
  const bearishSignal = getBearishSignal()

  return (
    <div className="animate-slide-in-from-bottom">
      <Header
        title="Divergence Analysis"
        subtitle="RSI divergence pattern detection"
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
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="primary"
                icon="TrendUp"
                onClick={() => handleAnalyze('bullish')}
                disabled={loading}
              >
                <span>{loading ? 'Loading...' : 'Bullish'}</span>
              </Button>
              <Button
                variant="bear"
                className="flex-1"
                icon="TrendDown"
                onClick={() => handleAnalyze('bearish')}
                disabled={loading}
              >
                <span>{loading ? 'Loading...' : 'Bearish'}</span>
              </Button>
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
            currentRsi={bullishSignal.currentRsi}
            confidence={bullishSignal.confidence}
            divergenceType={bullishSignal.divergenceType}
            strength={bullishSignal.strength}
          />
        ) : (
          <SignalCard
            type="bullish"
            title="Bullish Divergence"
            value="HOLD"
            currentRsi={0}
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
            currentRsi={bearishSignal.currentRsi}
            confidence={bearishSignal.confidence}
            divergenceType={bearishSignal.divergenceType}
            strength={bearishSignal.strength}
          />
        ) : (
          <SignalCard
            type="bearish"
            title="Bearish Divergence"
            value="HOLD"
            currentRsi={0}
            confidence={0}
            divergenceType="N/A"
            strength="None"
          />
        )}
      </div>

      <Card>
        <Card.Header
          action={
            <div className="flex gap-2">
              <Badge variant="bull">{String(bullishCount)} Bullish</Badge>
              <Badge variant="bear">{String(bearishCount)} Bearish</Badge>
            </div>
          }
        >
          <Icons.Chart />
          <span>Price &amp; RSI Chart — {symbol || 'Select a symbol'}</span>
        </Card.Header>
        <Card.Body>
          <ChartPlaceholder symbol={symbol || 'FPT'} />
        </Card.Body>
      </Card>
    </div>
  )
}
