export type Page = 'dashboard' | 'screener' | 'divergence' | 'config' | 'settings'

export type Exchange = 'HOSE' | 'HNX' | 'UPCOM'

export type SignalType = 'bullish' | 'bearish'

export type BadgeVariant = 'hose' | 'hnx' | 'upcom' | 'bull' | 'bear'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

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
}

export interface StatCard {
  label: string
  value: string | number
  change?: string
  variant?: 'bullish' | 'bearish' | 'default'
}

export interface DivergenceSignal {
  type: SignalType
  currentRsi: number
  confidence: number
  divergenceType?: string
  strength: string
}

export interface FilterChip {
  label: string
  active: boolean
  value: string
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

// Screener filter preset types
export interface ScreenerFilterPreset {
  name: string
  filters: Array<{ field: string; op: string; value: number }>
  logic: 'and' | 'or'
  exchanges?: string[]
  created_at: string
}

export interface WatchlistAction {
  type: 'bullish' | 'bearish'
  symbols: string[]
}
