import { useState, useEffect, useCallback } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '../icons/Icons'
import { MetricsFilterSection } from '../features/MetricsFilterSection'
import { StockAlertsSection } from '../features/StockAlertsSection'
import { NumberInput } from '@/components/ui/NumberInput'
import { api, getConfigId, type ApiTradingConfig, type ApiStockAlert, type ApiAlertCondition, type ScreenerFilterPreset } from '@/lib/api'
import { isValidFilterOperator } from '@/lib/screenerFilterOptions'
import { getConditionOption, MA_REFERENCE_OPTIONS } from '@/lib/alertOptions'

// Mirror of bot-trade/domain/config/valueobject/stock_alert_config.go Validate():
// the backend rejects enabled conditions whose type RequiresThreshold but has
// threshold <= 0, or RequiresReference but lacks a valid MA pick. Disabled
// conditions are accepted as paused placeholders regardless of payload, so we
// never strip them. Dropping bad conditions client-side keeps a partial-typo
// in the alert editor from 400'ing the entire config save.
const VALID_MA_REFERENCES = new Set<string>(MA_REFERENCE_OPTIONS.map(o => o.value))

function isConditionSubmittable(c: ApiAlertCondition): boolean {
  if (c.enabled === false) return true
  const opt = getConditionOption(c.type)
  if (!opt) return false
  if (opt.hasThreshold && (!Number.isFinite(c.threshold) || c.threshold <= 0)) return false
  if (opt.hasReference && !VALID_MA_REFERENCES.has(c.reference ?? '')) return false
  return true
}

export function Config() {
  const [config, setConfig] = useState<ApiTradingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
        alerts: (config.alerts || [])
          // Drop conditions that would fail backend Validate (typed predicate
          // mirrors AlertType.RequiresThreshold / RequiresReference). Keeps
          // valid sibling conditions on the same alert intact.
          .map(a => ({ ...a, conditions: a.conditions.filter(isConditionSubmittable) }))
          .filter(a =>
            a.symbol.trim().length > 0 &&
            a.conditions.length > 0
          )
          .map(a => ({
            symbol: a.symbol,
            conditions: a.conditions.map(c => ({
              type: c.type,
              threshold: c.threshold,
              enabled: c.enabled !== false, // default true for any stale payload
              ...(c.reference ? { reference: c.reference } : {}),
            })),
          })),
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

  const handleUpdateMetricsFilter = (filters: ScreenerFilterPreset[]) => {
    if (config) {
      setConfig({ ...config, metrics_filter: filters })
    }
  }

  const handleUpdateAlerts = (alerts: ApiStockAlert[]) => {
    if (config) {
      setConfig({ ...config, alerts })
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
                <div className="form-group mt-4">
                  <label className="form-label">Signal recency window (days)</label>
                  <NumberInput
                    className="form-input"
                    value={config.signal_days_threshold}
                    onChange={v => updateField('signal_days_threshold', v)}
                    min={1}
                    max={365}
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                    Alerts only fire for trendline / RSI-divergence signals detected within
                    this many recent days — not across the whole analyzed range. Lower = only
                    fresh signals; higher = also older ones. Used by your analyze alerts.
                  </p>
                </div>
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

      {/* Stock Alerts - Full width section */}
      <StockAlertsSection
        alerts={config.alerts || []}
        originalAlerts={originalConfig?.alerts || []}
        onUpdate={handleUpdateAlerts}
      />
    </div>
  )
}
