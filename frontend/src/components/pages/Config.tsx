import { useState, useEffect, useCallback } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '../icons/Icons'
import { SymbolTag } from '../features/SymbolTag'
import { MetricsFilterSection } from '../features/MetricsFilterSection'
import { NumberInput } from '@/components/ui/NumberInput'
import { api, getConfigId, type ApiTradingConfig, type ScreenerFilterPreset } from '@/lib/api'
import { isValidFilterOperator } from '@/lib/screenerFilterOptions'

export function Config() {
  const [config, setConfig] = useState<ApiTradingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form input states
  const [newBullSymbol, setNewBullSymbol] = useState('')
  const [newBearSymbol, setNewBearSymbol] = useState('')

  // Store original config for reset
  const [originalConfig, setOriginalConfig] = useState<ApiTradingConfig | null>(null)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const configId = getConfigId()
      const data = await api.getConfig(configId)
      setConfig(data)
      setOriginalConfig(data)
    } catch (err) {
      // If config doesn't exist, create default
      if (err instanceof Error && err.message.includes('not found')) {
        try {
          const configId = getConfigId()
          const newConfig = await api.createConfig(configId)
          setConfig(newConfig)
          setOriginalConfig(newConfig)
        } catch (createErr) {
          setError(createErr instanceof Error ? createErr.message : 'Failed to create config')
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load config')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const configId = getConfigId()
      // Sanitize metrics_filter to remove invalid filters before saving
      const sanitizedConfig = {
        ...config,
        metrics_filter: (config.metrics_filter || []).map(preset => ({
          ...preset,
          filters: preset.filters.filter(f => f.op && isValidFilterOperator(f.op)),
        })).filter(preset => preset.filters.length > 0),
      }
      const updated = await api.updateConfig(configId, sanitizedConfig)
      setConfig(updated)
      setOriginalConfig(updated)
      setSuccess('Configuration saved successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (originalConfig) {
      setConfig({ ...originalConfig })
      setSuccess('Form reset to saved values')
    }
  }

  const updateField = <K extends keyof ApiTradingConfig>(field: K, value: ApiTradingConfig[K]) => {
    if (config) {
      setConfig({ ...config, [field]: value })
    }
  }

  const updateDivergence = (key: 'range_min' | 'range_max', value: number) => {
    if (config) {
      setConfig({
        ...config,
        divergence: { ...config.divergence, [key]: value },
      })
    }
  }

  const updateTrendline = (key: 'max_lines' | 'proximity_percent', value: number) => {
    if (config) {
      setConfig({
        ...config,
        trendline: { ...config.trendline, [key]: value },
      })
    }
  }

  const handleAddBullSymbol = async () => {
    const symbol = newBullSymbol.trim().toUpperCase()
    if (!symbol || !config || config.bullish_symbols.includes(symbol)) {
      setNewBullSymbol('')
      return
    }

    try {
      const configId = getConfigId()
      await api.addSymbolsToWatchlist(configId, 'bullish', [symbol])
      setConfig({ ...config, bullish_symbols: [...config.bullish_symbols, symbol] })
      setNewBullSymbol('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add symbol')
    }
  }

  const handleAddBearSymbol = async () => {
    const symbol = newBearSymbol.trim().toUpperCase()
    if (!symbol || !config || config.bearish_symbols.includes(symbol)) {
      setNewBearSymbol('')
      return
    }

    try {
      const configId = getConfigId()
      await api.addSymbolsToWatchlist(configId, 'bearish', [symbol])
      setConfig({ ...config, bearish_symbols: [...config.bearish_symbols, symbol] })
      setNewBearSymbol('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add symbol')
    }
  }

  const handleRemoveBullSymbol = async (symbol: string) => {
    if (!config) return

    try {
      const configId = getConfigId()
      await api.removeSymbolsFromWatchlist(configId, 'bullish', [symbol])
      setConfig({ ...config, bullish_symbols: config.bullish_symbols.filter(s => s !== symbol) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove symbol')
    }
  }

  const handleRemoveBearSymbol = async (symbol: string) => {
    if (!config) return

    try {
      const configId = getConfigId()
      await api.removeSymbolsFromWatchlist(configId, 'bearish', [symbol])
      setConfig({ ...config, bearish_symbols: config.bearish_symbols.filter(s => s !== symbol) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove symbol')
    }
  }

  const handleUpdateMetricsFilter = (filters: ScreenerFilterPreset[]) => {
    if (config) {
      setConfig({ ...config, metrics_filter: filters })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="animate-slide-in-from-bottom">
        <Header title="Trading Configuration" subtitle="Customize analysis parameters and alerts" />
        <Card className="p-8 text-center">
          <p className="text-red-400">{error || 'Failed to load configuration'}</p>
          <Button variant="secondary" onClick={fetchConfig} className="mt-4">
            Retry
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="animate-slide-in-from-bottom">
      <Header
        title="Trading Configuration"
        subtitle="Customize analysis parameters and alerts"
        actions={
          <>
            <Button variant="secondary" icon="Undo" onClick={handleReset} disabled={saving}>
              <span>Reset Defaults</span>
            </Button>
            <Button variant="primary" icon="Save" onClick={handleSave} disabled={saving}>
              <span>{saving ? 'Saving...' : 'Save Config'}</span>
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
          {success}
        </div>
      )}

      <div className="grid-2">
        <div>
          <Card className="mb-6">
            <Card.Body>
              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.Chart />
                  <span>RSI Settings</span>
                </h3>
                <div className="config-grid-2">
                  <div className="form-group !mb-0">
                    <label className="form-label">RSI Period</label>
                    <NumberInput
                      className="form-input"
                      value={config.rsi_period}
                      onChange={v => updateField('rsi_period', v)}
                    />
                  </div>
                  <div className="form-group !mb-0">
                    <label className="form-label">Pivot Period</label>
                    <NumberInput
                      className="form-input"
                      value={config.pivot_period}
                      onChange={v => updateField('pivot_period', v)}
                    />
                  </div>
                </div>
                <div className="form-group mt-4">
                  <label className="form-label">Lookback Days</label>
                  <NumberInput
                    className="form-input"
                    value={config.lookback_day}
                    onChange={v => updateField('lookback_day', v)}
                  />
                </div>
              </div>

              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.Zap />
                  <span>Divergence Parameters</span>
                </h3>
                <div className="config-grid-2">
                  <div className="form-group !mb-0">
                    <label className="form-label">Range Min</label>
                    <NumberInput
                      className="form-input"
                      value={config.divergence.range_min}
                      onChange={v => updateDivergence('range_min', v)}
                    />
                  </div>
                  <div className="form-group !mb-0">
                    <label className="form-label">Range Max</label>
                    <NumberInput
                      className="form-input"
                      value={config.divergence.range_max}
                      onChange={v => updateDivergence('range_max', v)}
                    />
                  </div>
                </div>
                <div className="form-group mt-4">
                  <label className="form-label">Recent Indices</label>
                  <NumberInput
                    className="form-input"
                    value={config.indices_recent}
                    onChange={v => updateField('indices_recent', v)}
                  />
                </div>
                <label className="form-checkbox mt-4">
                  <input
                    type="checkbox"
                    checked={config.bearish_early ?? false}
                    onChange={e => updateField('bearish_early', e.target.checked)}
                  />
                  <span>Enable early detection mode</span>
                </label>
              </div>

              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.TrendUp />
                  <span>Trendline Parameters</span>
                </h3>
                <div className="config-grid-2">
                  <div className="form-group !mb-0">
                    <label className="form-label">Max Lines</label>
                    <NumberInput
                      className="form-input"
                      value={config.trendline.max_lines}
                      onChange={v => updateTrendline('max_lines', v)}
                    />
                  </div>
                  <div className="form-group !mb-0">
                    <label className="form-label">Proximity %</label>
                    <NumberInput
                      className="form-input"
                      step="0.1"
                      value={config.trendline.proximity_percent}
                      onChange={v => updateTrendline('proximity_percent', v)}
                    />
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div>
          <Card className="mb-6">
            <Card.Body>
              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.TrendUp />
                  <span>Bullish Watch Symbols</span>
                </h3>
                <input
                  type="text"
                  className="form-input mb-4"
                  placeholder="Add symbol and press Enter"
                  value={newBullSymbol}
                  onChange={e => setNewBullSymbol(e.target.value.toUpperCase())}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddBullSymbol()
                    }
                  }}
                />
                <div className="symbol-tags">
                  {config.bullish_symbols.map(symbol => (
                    <SymbolTag key={symbol} symbol={symbol} onRemove={handleRemoveBullSymbol} />
                  ))}
                </div>
              </div>

              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.TrendDown />
                  <span>Bearish Watch Symbols</span>
                </h3>
                <input
                  type="text"
                  className="form-input mb-4"
                  placeholder="Add symbol and press Enter"
                  value={newBearSymbol}
                  onChange={e => setNewBearSymbol(e.target.value.toUpperCase())}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddBearSymbol()
                    }
                  }}
                />
                <div className="symbol-tags">
                  {config.bearish_symbols.map(symbol => (
                    <SymbolTag key={symbol} symbol={symbol} onRemove={handleRemoveBearSymbol} />
                  ))}
                </div>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <div className="config-section !mb-0">
                <h3 className="config-section-title">
                  <Icons.Send />
                  <span>Telegram Notifications</span>
                </h3>
                <label className="form-checkbox mb-4">
                  <input
                    type="checkbox"
                    checked={config.telegram.enabled}
                    onChange={e =>
                      setConfig({
                        ...config,
                        telegram: { ...config.telegram, enabled: e.target.checked },
                      })
                    }
                  />
                  <span>Enable Telegram notifications</span>
                </label>
                {config.telegram.enabled && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Bot Token</label>
                      <input
                        type="password"
                        className="form-input"
                        value={config.telegram.bot_token || ''}
                        onChange={e =>
                          setConfig({
                            ...config,
                            telegram: { ...config.telegram, bot_token: e.target.value },
                          })
                        }
                        placeholder="Enter bot token"
                      />
                    </div>
                    <div className="form-group !mb-0">
                      <label className="form-label">Chat ID</label>
                      <input
                        type="text"
                        className="form-input"
                        value={config.telegram.chat_id || ''}
                        onChange={e =>
                          setConfig({
                            ...config,
                            telegram: { ...config.telegram, chat_id: e.target.value },
                          })
                        }
                        placeholder="Enter chat ID"
                      />
                    </div>
                  </>
                )}
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Metrics Filter Presets - Full width section */}
      <MetricsFilterSection
        filters={config.metrics_filter || []}
        onUpdate={handleUpdateMetricsFilter}
      />
    </div>
  )
}