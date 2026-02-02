// API client for Trading Bot backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// localStorage key for config ID persistence
const CONFIG_ID_STORAGE_KEY = 'trading-app_config-id'

// Default config ID for divergence analysis (can be overridden)
let DEFAULT_CONFIG_ID = 'default'

/**
 * Initialize config ID from localStorage on app load
 * Call this during app initialization to sync localStorage with the API client
 */
export function initConfigId(): string {
  try {
    const stored = localStorage.getItem(CONFIG_ID_STORAGE_KEY)
    if (stored) {
      DEFAULT_CONFIG_ID = stored
      return stored
    }
  } catch {
    // localStorage might be disabled (e.g., in incognito mode)
  }
  return DEFAULT_CONFIG_ID
}

/**
 * Update the config ID used for API calls
 * This should be called after a user successfully enters their username
 */
export function setConfigId(id: string) {
  DEFAULT_CONFIG_ID = id
}

/**
 * Get the current config ID being used for API calls
 */
export function getConfigId(): string {
  return DEFAULT_CONFIG_ID
}

// Initialize config ID from localStorage on module load
initConfigId()

export interface ApiStockMetrics {
  symbol: string
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
}

export interface ApiFilterRequest {
  filters?: Array<{
    field: string
    op: string
    value: number
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

export interface ApiDivergenceRequest {
  symbol: string
  timeframe?: string
}

export interface ApiDivergenceResult {
  symbol: string
  processing_time_ms?: number
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
}

// Trading config types
export interface ApiTradingConfig {
  id: string
  rsi_period: number
  start_date_offset: number
  divergence: {
    lookback_left: number
    lookback_right: number
    range_min: number
    range_max: number
    indices_recent: number
  }
  early_detection_enabled: boolean
  bearish_symbols: string[]
  bullish_symbols: string[]
  screener_filters?: ScreenerFilterPreset[]
  telegram: {
    enabled: boolean
    bot_token?: string
    chat_id?: string
  }
  created_at: string
  updated_at: string
}

export interface ScreenerFilterPreset {
  name: string
  filters: Array<{ field: string; op: string; value: number }>
  logic: 'and' | 'or'
  exchanges?: string[]
  created_at: string
}

export interface WatchlistRequest {
  list_type: 'bullish' | 'bearish'
  symbols: string[]
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

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health')
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

  // Divergence analysis endpoints
  async analyzeBullishDivergence(symbol: string, configId?: string): Promise<ApiDivergenceResult> {
    const config = configId || DEFAULT_CONFIG_ID
    return this.request(`/analyze/${encodeURIComponent(symbol)}/divergence/bullish?config_id=${encodeURIComponent(config)}`)
  }

  async analyzeBearishDivergence(symbol: string, configId?: string): Promise<ApiDivergenceResult> {
    const config = configId || DEFAULT_CONFIG_ID
    return this.request(`/analyze/${encodeURIComponent(symbol)}/divergence/bearish?config_id=${encodeURIComponent(config)}`)
  }

  // Config management endpoints
  async getConfig(id: string): Promise<ApiTradingConfig> {
    return this.request(`/config/${encodeURIComponent(id)}`)
  }

  async createConfig(id: string, config?: Partial<ApiTradingConfig>): Promise<ApiTradingConfig> {
    const defaultConfig = {
      id,
      rsi_period: 14,
      start_date_offset: 365,
      divergence: {
        lookback_left: 5,
        lookback_right: 5,
        range_min: 30,
        range_max: 70,
        indices_recent: 3,
      },
      early_detection_enabled: false,
      bearish_symbols: [],
      bullish_symbols: [],
      telegram: { enabled: false },
      screener_filters: [],
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

  async addSymbolsToWatchlist(configId: string, listType: 'bullish' | 'bearish', symbols: string[]): Promise<{ message: string; list_type: string; symbols: string[] }> {
    return this.request(`/config/${encodeURIComponent(configId)}/watchlist`, {
      method: 'POST',
      body: JSON.stringify({ list_type: listType, symbols }),
    })
  }

  async removeSymbolsFromWatchlist(configId: string, listType: 'bullish' | 'bearish', symbols: string[]): Promise<{ message: string; list_type: string; symbols: string[] }> {
    return this.request(`/config/${encodeURIComponent(configId)}/watchlist`, {
      method: 'DELETE',
      body: JSON.stringify({ list_type: listType, symbols }),
    })
  }
}

// Singleton instance
export const api = new ApiClient()

// Helper to convert API metrics to frontend Stock type
export function apiToStock(api: ApiStockMetrics) {
  const volumeVsSma = api.volume_sma20 > 0
    ? ((api.current_volume - api.volume_sma20) / api.volume_sma20 * 100)
    : 0

  return {
    symbol: api.symbol,
    name: api.symbol, // Backend doesn't provide name, use symbol
    exchange: api.exchange as 'HOSE' | 'HNX' | 'UPCOM',
    rs1m: api.rs_1m,
    rs3m: api.rs_3m,
    rs6m: api.rs_6m,
    rs9m: api.rs_9m,
    rs52w: api.rs_52w,
    currentVolume: api.current_volume,
    volumeSma20: api.volume_sma20,
    volume: volumeVsSma > 0 ? `+${volumeVsSma.toFixed(1)}%` : `${volumeVsSma.toFixed(1)}%`,
    price: 0, // Not provided by backend
    change: 0, // Not provided by backend
  }
}
