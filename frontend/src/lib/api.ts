// API client for Trading Bot backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// localStorage key for config ID persistence (shared with useConfigId)
export const CONFIG_ID_STORAGE_KEY = 'trading-app_config-id'

// Default config ID for divergence analysis (can be overridden)
let DEFAULT_CONFIG_ID = 'default'
let configIdInitialized = false

/**
 * Initialize config ID from localStorage on app load
 * Call this during app initialization to sync localStorage with the API client
 * Moved from module-level execution to prevent hydration mismatches
 */
function initConfigId(): string {
  if (configIdInitialized) {
    return DEFAULT_CONFIG_ID
  }

  try {
    const stored = localStorage.getItem(CONFIG_ID_STORAGE_KEY)
    if (stored) {
      DEFAULT_CONFIG_ID = stored
      configIdInitialized = true
      return stored
    }
  } catch {
    // localStorage might be disabled (e.g., in incognito mode)
  }
  configIdInitialized = true
  return DEFAULT_CONFIG_ID
}

/**
 * Update the config ID used for API calls
 * This should be called after a user successfully enters their username
 */
export function setConfigId(id: string) {
  DEFAULT_CONFIG_ID = id
  configIdInitialized = true
  try {
    localStorage.setItem(CONFIG_ID_STORAGE_KEY, id)
  } catch {
    // localStorage might be disabled
  }
}

/**
 * Get the current config ID being used for API calls
 * Lazily initializes from localStorage on first call
 */
export function getConfigId(): string {
  if (!configIdInitialized) {
    return initConfigId()
  }
  return DEFAULT_CONFIG_ID
}

// Types for stock metrics
export interface ApiStockMetrics {
  symbol: string
  name?: string // Vietnamese stock name from listallstock
  exchange: string
  rs_1m: number
  rs_3m: number
  rs_6m: number
  rs_9m: number
  rs_52w: number
  current_volume: number
  volume_sma20: number
  period_returns?: {
    p1: number
    p3: number
    p6: number
    p9: number
    p12: number
  }
  // Price metrics
  current_price: number
  price_change_pct: number
  // Moving averages
  ema_9: number
  ema_21: number
  ema_50: number
  sma_200: number
  // Signal metrics
  has_breakout_potential?: boolean
  has_breakout_confirmed?: boolean
  has_breakdown_potential?: boolean
  has_breakdown_confirmed?: boolean
  has_bullish_rsi?: boolean
  has_bearish_rsi?: boolean
}

export interface ScreenerFilterPreset {
  name: string
  filters: Array<{ field: string; op: string; value?: number | boolean }>
  logic: 'and' | 'or'
  exchanges?: string[]
  created_at: string
}

export interface ApiFilterRequest {
  filters?: Array<{
    field: string
    op: string
    value?: number | boolean
  }>
  logic?: 'and' | 'or'
  exchanges?: string[]
}

export interface ApiCacheInfo {
  cached: boolean
  cached_at?: string
  total_stocks?: number
  message?: string
}

export interface ApiRefreshResult {
  message: string
  total_stocks: number
  stocks_ranked: number
  calculated_at: string
}

// Unified Analysis Result Types
export interface ApiTrendlineInfo {
  type: string // "uptrend_support" or "downtrend_resistance"
  start_price: number
  end_price: number
  start_date: string
  end_date: string
  slope: number
}

export interface ApiTrendlineDataPoint {
  date: string
  price: number
}

export interface ApiTrendlineDisplay {
  type: string
  data_points: ApiTrendlineDataPoint[]  // Pre-calculated points for each trading date
  start_price: number
  end_price: number
  start_date: string
  end_date: string
  slope: number
}

// Signal from analyze API - contains crossover point for trendline extension
export interface ApiAnalysisSignal {
  type: string        // "breakdown_confirmed", "breakout_confirmed", etc.
  price: number       // Actual price at crossover
  time: string        // Date of crossover
  price_line?: number  // Trendline price at crossover (extension point)
}

export interface ApiTradingSignal {
  id: string
  type: string // "breakdown_confirmed", "breakdown_potential", "breakout_confirmed", "breakout_potential"
  price: number
  message: string
  source: string
  time: string
  target?: number
  stop_loss?: number
  trendline?: ApiTrendlineInfo
  interval?: string
  price_line?: number  // Trendline price at crossover point (from analyze API)
}

// Helper function to check if a signal is confirmed
export function isSignalConfirmed(signal: ApiTradingSignal): boolean {
  return signal.type.endsWith('_confirmed')
}

// Helper function to check if a signal is potential
export function isSignalPotential(signal: ApiTradingSignal): boolean {
  return signal.type.endsWith('_potential')
}

export interface ApiPriceData {
  index: number
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Divergence DTO matching backend DivergenceDTO
export interface ApiDivergence {
  type: 'bullish' | 'bearish'
  is_early: boolean
  divergence_points: Array<{
    price: number
    date: string
  }>
}

// Divergence wrapper for unified response (legacy)
export interface ApiDivergenceWrapper {
  processing_time_ms: number
  timestamp: string
  parameters: {
    start_date: string
    end_date: string
    interval: string
    rsi_period: number
  }
  divergence: {
    type: string
    description: string
    divergence_found: boolean
    current_price: number
    current_rsi: number
  }
  early_signal?: {
    detected: boolean
    description: string
  }
}

// Unified analysis result - combines all analysis types
export interface ApiAnalysisResult {
  symbol: string
  processing_time_ms: number
  timestamp: string
  parameters: {
    start_date: string
    end_date: string
    interval: string
    current_price: number
  }
  divergences: ApiDivergence[]  // Combined divergences array with type field
  signals: ApiTradingSignal[]
  signals_count: number
  price_history: ApiPriceData[]
  trendlines: ApiTrendlineDisplay[]  // Active trendlines with pre-calculated data points
}

// Trading config types - matches backend TradingConfigResponse
export interface ApiTradingConfig {
  id: string
  rsi_period: number
  pivot_period: number
  lookback_day: number
  divergence: {
    range_min: number
    range_max: number
  }
  trendline: {
    max_lines: number
    proximity_percent: number
  }
  indices_recent: number
  bearish_early: boolean | null
  bearish_symbols: string[]
  bullish_symbols: string[]
  telegram: {
    enabled: boolean
    bot_token?: string
    chat_id?: string
  }
  metrics_filter?: ScreenerFilterPreset[]
  created_at: string
  updated_at: string
}

// Legacy type aliases for backward compatibility
export type ApiDivergenceResult = ApiDivergenceWrapper

// Signal analysis result - used by legacy getSignals method
export interface ApiSignalAnalysisResult {
  symbol: string
  processing_time_ms: number
  timestamp: string
  parameters: {
    start_date: string
    end_date: string
    interval: string
    current_price: number
  }
  signals: ApiTradingSignal[]
  signals_count: number
  price_history: ApiPriceData[]
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || error.details || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Stock metrics endpoints
  async getCacheInfo(): Promise<ApiCacheInfo> {
    return this.request('/stocks/cache-info')
  }

  async refreshStocks(): Promise<ApiRefreshResult> {
    return this.request('/stocks/refresh', {
      method: 'POST',
    })
  }

  async filterStocks(filter: ApiFilterRequest): Promise<{ stocks: ApiStockMetrics[] }> {
    return this.request('/stocks/filter', {
      method: 'POST',
      body: JSON.stringify(filter),
    })
  }

  // Unified analysis endpoint - returns all analysis types in one call
  async analyzeSymbol(
    symbol: string,
    options?: {
      configId?: string
      startDate?: string
      endDate?: string
      interval?: string
    }
  ): Promise<ApiAnalysisResult> {
    const { configId, startDate, endDate, interval } = options || {}
    const config = configId || DEFAULT_CONFIG_ID
    const params = new URLSearchParams({ config_id: config })
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    if (interval) params.set('interval', interval)
    return this.request(`/analyze/${encodeURIComponent(symbol)}?${params.toString()}`)
  }

  // Legacy signals method - extracts signals from unified response
  async getSignals(
    symbol: string,
    options?: {
      type?: 'all' | 'breakdown' | 'breakout' | 'confirmed' | 'watching'
      configId?: string
      startDate?: string
      endDate?: string
      interval?: string
    }
  ): Promise<ApiSignalAnalysisResult> {
    const { type, configId, startDate, endDate, interval } = options || {}
    const result = await this.analyzeSymbol(symbol, { configId, startDate, endDate, interval })

    // Filter signals by type if specified
    let filteredSignals = result.signals
    if (type && type !== 'all') {
      filteredSignals = result.signals.filter(s => {
        const signalType = s.type
        switch (type) {
          case 'breakdown':
            return signalType.includes('breakdown')
          case 'breakout':
            return signalType.includes('breakout')
          case 'confirmed':
            return isSignalConfirmed(s)
          case 'watching':
            return isSignalPotential(s)
          default:
            return true
        }
      })
    }

    return {
      symbol: result.symbol,
      processing_time_ms: result.processing_time_ms,
      timestamp: result.timestamp,
      parameters: result.parameters,
      signals: filteredSignals,
      signals_count: filteredSignals.length,
      price_history: result.price_history,
    }
  }

  // Convenience method for backward compatibility
  async analyzeSignals(
    symbol: string,
    configId?: string,
    startDate?: string,
    endDate?: string,
    interval?: string
  ): Promise<ApiSignalAnalysisResult> {
    return this.getSignals(symbol, { type: 'all', configId, startDate, endDate, interval })
  }

  // Config management endpoints
  async getConfig(id: string): Promise<ApiTradingConfig> {
    return this.request(`/config/${encodeURIComponent(id)}`)
  }

  async createConfig(id: string, config?: Partial<ApiTradingConfig>): Promise<ApiTradingConfig> {
    const defaultConfig = {
      id,
      rsi_period: 14,
      pivot_period: 5,
      lookback_day: 365,
      divergence: {
        range_min: 30,
        range_max: 70,
      },
      trendline: {
        max_lines: 5,
        proximity_percent: 3,
      },
      indices_recent: 5,
      bearish_early: null,
      bearish_symbols: [],
      bullish_symbols: [],
      telegram: { enabled: false },
      metrics_filter: [],
    }
    return this.request('/config', {
      method: 'POST',
      body: JSON.stringify({ ...defaultConfig, ...config }),
    })
  }

  async updateConfig(id: string, config: Partial<ApiTradingConfig>): Promise<ApiTradingConfig> {
    return this.request(`/config/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    })
  }

  async addSymbolsToWatchlist(
    configId: string,
    listType: 'bullish' | 'bearish',
    symbols: string[]
  ): Promise<{ message: string; list_type: string; symbols: string[] }> {
    return this.request(`/config/${encodeURIComponent(configId)}/watchlist`, {
      method: 'POST',
      body: JSON.stringify({ list_type: listType, symbols }),
    })
  }

  async removeSymbolsFromWatchlist(
    configId: string,
    listType: 'bullish' | 'bearish',
    symbols: string[]
  ): Promise<{ message: string; list_type: string; symbols: string[] }> {
    return this.request(`/config/${encodeURIComponent(configId)}/watchlist`, {
      method: 'DELETE',
      body: JSON.stringify({ list_type: listType, symbols }),
    })
  }
}

// Singleton instance
const apiInstance = new ApiClient()

export { apiStockMetricsToStock as apiToStock } from './screenerUtils'

// Re-export api instance methods
export const api = {
  getCacheInfo: () => apiInstance.getCacheInfo(),
  refreshStocks: () => apiInstance.refreshStocks(),
  filterStocks: (f: ApiFilterRequest) => apiInstance.filterStocks(f),

  // New unified analysis method
  analyzeSymbol: (
    s: string,
    o?: { configId?: string; startDate?: string; endDate?: string; interval?: string }
  ) => apiInstance.analyzeSymbol(s, o),

  getSignals: (
    s: string,
    o?: { type?: 'all' | 'breakdown' | 'breakout' | 'confirmed' | 'watching'; configId?: string; startDate?: string; endDate?: string; interval?: string }
  ) => apiInstance.getSignals(s, o),
  analyzeSignals: (s: string, c?: string, sd?: string, ed?: string, i?: string) =>
    apiInstance.analyzeSignals(s, c, sd, ed, i),

  // Config methods
  getConfig: (id: string) => apiInstance.getConfig(id),
  createConfig: (id: string, c?: Partial<ApiTradingConfig>) => apiInstance.createConfig(id, c),
  updateConfig: (id: string, c: Partial<ApiTradingConfig>) => apiInstance.updateConfig(id, c),
  addSymbolsToWatchlist: (cId: string, lT: 'bullish' | 'bearish', s: string[]) =>
    apiInstance.addSymbolsToWatchlist(cId, lT, s),
  removeSymbolsFromWatchlist: (cId: string, lT: 'bullish' | 'bearish', s: string[]) =>
    apiInstance.removeSymbolsFromWatchlist(cId, lT, s),
}
