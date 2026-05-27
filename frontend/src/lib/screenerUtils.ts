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
    name: api.name ?? api.symbol, // Use actual name, fallback to symbol
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

/* ------------------------------------------------------------------ */
/* Client-side column sorting for the screener results table          */
/* ------------------------------------------------------------------ */

/** Column ids that map to a single sortable Stock field. */
export type ScreenerSortField =
  | 'symbol'
  | 'exchange'
  | 'rs1m'
  | 'rs3m'
  | 'rs6m'
  | 'rs9m'
  | 'rs52w'
  | 'volumeVsSma'
  | 'currentVolume'
  | 'price'
  | 'change'
  | 'ema9'
  | 'ema21'
  | 'ema50'
  | 'sma200'

export type SortDirection = 'asc' | 'desc'

const STRING_SORT_FIELDS = new Set<ScreenerSortField>(['symbol', 'exchange'])

/** Table column ids that can be sorted (everything except checkbox + 'signals'). */
export const SORTABLE_COLUMNS = new Set<ScreenerSortField>([
  'symbol', 'exchange', 'rs1m', 'rs3m', 'rs6m', 'rs9m', 'rs52w',
  'volumeVsSma', 'currentVolume', 'price', 'change', 'ema9', 'ema21', 'ema50', 'sma200',
])

export function isSortableColumn(id: string): id is ScreenerSortField {
  return SORTABLE_COLUMNS.has(id as ScreenerSortField)
}

/** Numeric fields default to descending on first click (biggest first); strings to ascending. */
export function isNumericSortField(field: ScreenerSortField): boolean {
  return !STRING_SORT_FIELDS.has(field)
}

function sortValue(stock: Stock, field: ScreenerSortField): number | string | undefined {
  switch (field) {
    case 'symbol':
      return stock.symbol
    case 'exchange':
      return stock.exchange
    case 'rs1m':
      return stock.rs1m
    case 'rs3m':
      return stock.rs3m
    case 'rs6m':
      return stock.rs6m
    case 'rs9m':
      return stock.rs9m
    case 'rs52w':
      return stock.rs52w
    case 'volumeVsSma': {
      const n = parseFloat(stock.volume ?? '')
      return Number.isNaN(n) ? undefined : n
    }
    case 'currentVolume':
      return stock.currentVolume
    case 'price':
      return stock.price
    case 'change':
      return stock.change
    case 'ema9':
      return stock.ema9
    case 'ema21':
      return stock.ema21
    case 'ema50':
      return stock.ema50
    case 'sma200':
      return stock.sma200
  }
}

function isMissing(v: number | string | undefined): boolean {
  return v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))
}

/**
 * Stable client-side sort of stocks by a column field. Missing values
 * (undefined / NaN / empty) always sort to the bottom regardless of direction,
 * so they never crowd the top when sorting ascending.
 */
export function sortStocks(stocks: Stock[], field: ScreenerSortField, dir: SortDirection): Stock[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...stocks].sort((a, b) => {
    const av = sortValue(a, field)
    const bv = sortValue(b, field)
    const aMissing = isMissing(av)
    const bMissing = isMissing(bv)
    if (aMissing && bMissing) return 0
    if (aMissing) return 1
    if (bMissing) return -1
    if (typeof av === 'string' && typeof bv === 'string') {
      return factor * av.localeCompare(bv)
    }
    return factor * ((av as number) - (bv as number))
  })
}
