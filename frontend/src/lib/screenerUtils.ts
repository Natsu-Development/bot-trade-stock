import type { DynamicFilter } from '../types'
import type { ApiFilterRequest, ApiStockMetrics } from './api'

/**
 * Map dynamic filters to API filter format
 * Extracted from Screener component for better testability and reusability
 */
export function mapFiltersToApiFormat(
  dynamicFilters: DynamicFilter[],
  filterLogic: 'and' | 'or'
): ApiFilterRequest {
  const filters = dynamicFilters
    .filter(f => f.value !== '' && !isNaN(Number(f.value)))
    .map(f => ({
      field: f.field,
      op: f.operator,
      value: Number(f.value),
    }))

  return {
    filters,
    logic: filterLogic,
  }
}

/**
 * Transform API stock metrics to frontend Stock type
 */
export function transformApiStocks(apiStocks: ApiStockMetrics[]) {
  return apiStocks.map(api => {
    const volumeVsSma = api.volume_sma20 > 0
      ? ((api.current_volume - api.volume_sma20) / api.volume_sma20 * 100)
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
      price: 0,
      change: 0,
    }
  })
}
