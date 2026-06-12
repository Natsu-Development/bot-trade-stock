export type Page = 'dashboard' | 'screener' | 'analyze' | 'config' | 'settings'

export type Exchange = 'HOSE' | 'HNX' | 'UPCOM'

// Re-export the flat API filter request from the api client so legacy imports
// from '@/types' keep working after the flat normal-form migration.
export type { ApiFilterRequest } from '@/lib/api'

export type SignalType = 'bullish' | 'bearish'

export type RSLevel = 'high' | 'medium' | 'low'

export interface Stock {
  symbol: string
  name: string
  exchange: Exchange
  rs1m?: number
  rs3m?: number
  rs6m?: number
  rs9m?: number
  rs52w: number
  price: number
  change: number
  volume?: string
  currentVolume?: number
  volumeSma20?: number
  // Price metrics
  currentPrice: number
  priceChangePct: number
  // Moving averages
  ema9: number
  ema21: number
  ema50: number
  sma200: number
  // Signal metrics
  hasBreakoutPotential?: boolean
  hasBreakoutConfirmed?: boolean
  hasBreakdownPotential?: boolean
  hasBreakdownConfirmed?: boolean
  hasBullishRSI?: boolean
  hasBearishRSI?: boolean
}

// Dynamic Filter Builder Types
export type FilterField =
  | 'rs_1m'
  | 'rs_3m'
  | 'rs_6m'
  | 'rs_9m'
  | 'rs_52w'
  | 'volume_vs_sma'
  | 'current_volume'
  | 'volume_sma20'
  | 'current_price'
  | 'price_change_pct'
  | 'ema_9'
  | 'ema_21'
  | 'ema_50'
  | 'sma_200'
  | 'has_breakout_potential'
  | 'has_breakout_confirmed'
  | 'has_breakdown_potential'
  | 'has_breakdown_confirmed'
  | 'has_bullish_rsi'
  | 'has_bearish_rsi'

export type FilterOperator = '>=' | '<=' | '>' | '<' | '='

export type FilterLogic = 'and' | 'or'

/** Mirror of the backend caps (depth ≤ 3, ≤ 50 global leaves). */
export const MAX_FILTER_DEPTH = 3
export const MAX_FILTER_CONDITIONS = 50

/**
 * Client-side recursive filter tree node — the single canonical FE filter model.
 * A node is a LEAF when it carries a `condition`; otherwise it is a BRANCH
 * (`logic`/`negate`/`children`). The `id` is client-only (React keys / editing).
 */
export interface FilterTreeNode {
  id: string
  logic?: FilterLogic
  negate?: boolean
  children?: FilterTreeNode[]
  condition?: {
    field: FilterField
    op: FilterOperator
    value: number | boolean
    // When set, this leaf is a field-vs-field comparison (e.g. EMA 9 >= EMA 21):
    // `field` is the LHS, `rhsField` the RHS, both price-or-MA; `value` is unused.
    rhsField?: FilterField
  }
}

export interface DynamicFilter {
  id: string
  field: FilterField
  operator: FilterOperator
  value: number | boolean | ''
}

export interface FilterFieldOption {
  value: FilterField
  label: string
  shortLabel: string
  description: string
  category: 'RS Rating' | 'Volume' | 'Price' | 'Moving Avg' | 'Signal'
}

export interface QuickPreset {
  id: string
  name: string
  icon: string
  filters: Array<{ field: FilterField; operator: FilterOperator; value: number | boolean }>
}

export interface FilterOperatorOption {
  value: FilterOperator
  label: string
}
