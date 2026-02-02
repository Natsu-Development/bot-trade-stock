// API client for Trading Bot backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Default config ID for divergence analysis (can be overridden)
let DEFAULT_CONFIG_ID = 'default'

export function setConfigId(id: string) {
  DEFAULT_CONFIG_ID = id
}

export function getConfigId(): string {
  return DEFAULT_CONFIG_ID
}

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
