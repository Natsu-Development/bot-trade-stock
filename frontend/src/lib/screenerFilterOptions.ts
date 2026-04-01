import type { FilterFieldOption, FilterOperator, FilterOperatorOption } from '@/types'

/** Allowed filter operators for API / persisted presets */
export const VALID_FILTER_OPERATORS: readonly FilterOperator[] = [
  '>=',
  '<=',
  '>',
  '<',
  '=',
] as const

export function isValidFilterOperator(op: string): op is FilterOperator {
  return (VALID_FILTER_OPERATORS as readonly string[]).includes(op)
}

export const SCREENER_FIELD_OPTIONS: FilterFieldOption[] = [
  { value: 'rs_1m', label: 'RS 1M', shortLabel: 'RS 1M', description: '1-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_3m', label: 'RS 3M', shortLabel: 'RS 3M', description: '3-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_6m', label: 'RS 6M', shortLabel: 'RS 6M', description: '6-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_9m', label: 'RS 9M', shortLabel: 'RS 9M', description: '9-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_52w', label: 'RS 52W', shortLabel: 'RS 52W', description: '52-Week Relative Strength', category: 'RS Rating' },
  { value: 'volume_vs_sma', label: 'Vol vs SMA', shortLabel: 'Vol vs SMA', description: 'Volume vs SMA20 (%)', category: 'Volume' },
  { value: 'current_volume', label: 'Current Vol', shortLabel: 'Cur Vol', description: 'Current Volume', category: 'Volume' },
  { value: 'volume_sma20', label: 'Vol SMA20', shortLabel: 'Vol SMA20', description: '20-day SMA Volume', category: 'Volume' },
  // Price fields
  { value: 'current_price', label: 'Current Price', shortLabel: 'Price', description: 'Latest close price', category: 'Price' },
  { value: 'price_change_pct', label: 'Price Change %', shortLabel: 'Change %', description: 'Daily price change percentage', category: 'Price' },
  // Moving average fields
  { value: 'ema_9', label: 'Price vs EMA 9', shortLabel: 'vs EMA9', description: 'Current price vs EMA9', category: 'Moving Avg' },
  { value: 'ema_21', label: 'Price vs EMA 21', shortLabel: 'vs EMA21', description: 'Current price vs EMA21', category: 'Moving Avg' },
  { value: 'ema_50', label: 'Price vs EMA 50', shortLabel: 'vs EMA50', description: 'Current price vs EMA50', category: 'Moving Avg' },
  { value: 'sma_200', label: 'Price vs SMA 200', shortLabel: 'vs SMA200', description: 'Current price vs SMA200', category: 'Moving Avg' },
  // Signal fields
  { value: 'has_breakout_potential', label: 'Breakout Potential', shortLabel: 'BO Pot', description: 'Stock approaching resistance', category: 'Signal' },
  { value: 'has_breakout_confirmed', label: 'Breakout Confirmed', shortLabel: 'BO Conf', description: 'Stock broke above resistance', category: 'Signal' },
  { value: 'has_breakdown_potential', label: 'Breakdown Potential', shortLabel: 'BD Pot', description: 'Stock approaching support', category: 'Signal' },
  { value: 'has_breakdown_confirmed', label: 'Breakdown Confirmed', shortLabel: 'BD Conf', description: 'Stock broke below support', category: 'Signal' },
  { value: 'has_bullish_rsi', label: 'Bullish RSI', shortLabel: 'Bull RSI', description: 'Bullish RSI divergence detected', category: 'Signal' },
  { value: 'has_bearish_rsi', label: 'Bearish RSI', shortLabel: 'Bear RSI', description: 'Bearish RSI divergence detected', category: 'Signal' },
]

export const SCREENER_OPERATOR_OPTIONS: FilterOperatorOption[] = [
  { value: '>=', label: 'Greater or equal (≥)' },
  { value: '<=', label: 'Less or equal (≤)' },
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '=', label: 'Equal (=)' },
]

export const SCREENER_EXCHANGES = ['HOSE', 'HNX', 'UPCOM'] as const

/** Moving average filter fields */
export const MA_FIELDS = ['ema_9', 'ema_21', 'ema_50', 'sma_200'] as const

/** Signal filter fields (boolean) */
export const SIGNAL_FIELDS = [
  'has_breakout_potential',
  'has_breakout_confirmed',
  'has_breakdown_potential',
  'has_breakdown_confirmed',
  'has_bullish_rsi',
  'has_bearish_rsi',
] as const

/** Check if a filter field is a moving average type */
export function isMAField(field: string): boolean {
  return MA_FIELDS.includes(field as typeof MA_FIELDS[number])
}

/** Check if a filter field is a signal type (boolean) */
export function isSignalField(field: string): boolean {
  return SIGNAL_FIELDS.includes(field as typeof SIGNAL_FIELDS[number])
}

/** Operator labels for MA fields (Price Above/Below MA) */
export const MA_OPERATOR_LABELS: Record<string, string> = {
  '>': 'Above',
  '<': 'Below',
  '>=': 'At or Above',
  '<=': 'At or Below',
  '=': 'Equals',
}
