import type { DynamicFilter, Stock } from '../types'
import type { ApiFilterRequest, ApiStockMetrics } from './api'
import { isValidFilterOperator, isSignalField } from './screenerFilterOptions'

/**
 * Map dynamic filters to API filter format
 * Extracted from Screener component for better testability and reusability
 */
export function mapFiltersToApiFormat(
  dynamicFilters: DynamicFilter[],
  filterLogic: 'and' | 'or'
): ApiFilterRequest {
  const filters = dynamicFilters
    .filter(f => {
      // Signal fields need boolean values
      if (isSignalField(f.field)) {
        return typeof f.value === 'boolean'
      }
      // Numeric fields need valid numbers
      return f.value !== '' && !isNaN(Number(f.value)) && isValidFilterOperator(f.operator)
    })
    .map(f => {
      if (isSignalField(f.field)) {
        return {
          field: f.field,
          op: '=',
          value: f.value as boolean,
        }
      }
      return {
        field: f.field,
        op: f.operator,
        value: Number(f.value),
      }
    })

  return {
    filters,
    logic: filterLogic,
  }
}

/** Convert a single API metrics row to the dashboard/screener Stock shape */
export function apiStockMetricsToStock(api: ApiStockMetrics): Stock {
  const volumeVsSma =
    api.volume_sma20 > 0
      ? ((api.current_volume - api.volume_sma20) / api.volume_sma20) * 100
      : 0

  return {
    symbol: api.symbol,
    name: api.symbol,
    exchange: api.exchange as 'HOSE' | 'HNX' | 'UPCOM',
    rs1m: api.rs_1m,
    rs3m: api.rs_3m,
    rs6m: api.rs_6m,
    rs9m: api.rs_9m,
    rs52w: api.rs_52w,
    currentVolume: api.current_volume,
    volumeSma20: api.volume_sma20,
    volume: volumeVsSma > 0 ? `+${volumeVsSma.toFixed(1)}%` : `${volumeVsSma.toFixed(1)}%`,
    // Price metrics
    price: api.current_price,
    change: api.price_change_pct,
    currentPrice: api.current_price,
    priceChangePct: api.price_change_pct,
    // Moving averages
    ema9: api.ema_9,
    ema21: api.ema_21,
    ema50: api.ema_50,
    sma200: api.sma_200,
    // Signal metrics
    hasBreakoutPotential: api.has_breakout_potential,
    hasBreakoutConfirmed: api.has_breakout_confirmed,
    hasBreakdownPotential: api.has_breakdown_potential,
    hasBreakdownConfirmed: api.has_breakdown_confirmed,
    hasBullishRSI: api.has_bullish_rsi,
    hasBearishRSI: api.has_bearish_rsi,
  }
}

/**
 * Transform API stock metrics to frontend Stock type
 */
export function transformApiStocks(apiStocks: ApiStockMetrics[]): Stock[] {
  return apiStocks.map(apiStockMetricsToStock)
}
