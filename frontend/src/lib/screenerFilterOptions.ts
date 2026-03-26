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
]

export const SCREENER_OPERATOR_OPTIONS: FilterOperatorOption[] = [
  { value: '>=', label: 'Greater or equal (≥)' },
  { value: '<=', label: 'Less or equal (≤)' },
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '=', label: 'Equal (=)' },
]

export const SCREENER_EXCHANGES = ['HOSE', 'HNX', 'UPCOM'] as const
