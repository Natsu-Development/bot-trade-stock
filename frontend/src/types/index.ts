export type Page = 'dashboard' | 'screener' | 'divergence' | 'config' | 'settings'

export type Exchange = 'HOSE' | 'HNX' | 'UPCOM'

// API Filter Request type
export interface ApiFilterRequest {
  filters?: Array<{
    field: string
    op: string
    value: number
  }>
  logic?: 'and' | 'or'
  exchanges?: string[]
}

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

export type FilterOperator = '>=' | '<=' | '>' | '<' | '='

export interface DynamicFilter {
  id: string
  field: FilterField
  operator: FilterOperator
  value: number | ''
}

export interface FilterFieldOption {
  value: FilterField
  label: string
  shortLabel: string
  description: string
  category: 'RS Rating' | 'Volume'
}

export interface QuickPreset {
  id: string
  name: string
  icon: string
  filters: Array<{ field: FilterField; operator: FilterOperator; value: number }>
}

export interface FilterOperatorOption {
  value: FilterOperator
  label: string
}

