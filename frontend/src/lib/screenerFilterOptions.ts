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

// Labels are CANONICAL PARSER TOKENS (S4 / R5-C2): the formula tokenizer matches
// these strings longest-first. Keep them reconciled to the prototype's set —
// renaming a label is a grammar change. MA fields are BARE ("EMA 9"); the formula
// renders them as "Price <op> EMA 9". current_price → "Last Price" so the MA
// marker "Price" is unambiguous; volume_vs_sma → "Vol x SMA".
export const SCREENER_FIELD_OPTIONS: FilterFieldOption[] = [
  {
    value: 'rs_1m',
    label: 'RS 1M',
    shortLabel: 'RS 1M',
    description: '1-Month Relative Strength',
    category: 'RS Rating',
  },
  {
    value: 'rs_3m',
    label: 'RS 3M',
    shortLabel: 'RS 3M',
    description: '3-Month Relative Strength',
    category: 'RS Rating',
  },
  {
    value: 'rs_6m',
    label: 'RS 6M',
    shortLabel: 'RS 6M',
    description: '6-Month Relative Strength',
    category: 'RS Rating',
  },
  {
    value: 'rs_9m',
    label: 'RS 9M',
    shortLabel: 'RS 9M',
    description: '9-Month Relative Strength',
    category: 'RS Rating',
  },
  {
    value: 'rs_52w',
    label: 'RS 52W',
    shortLabel: 'RS 52W',
    description: '52-Week Relative Strength',
    category: 'RS Rating',
  },
  {
    value: 'volume_vs_sma',
    label: 'Vol x SMA',
    shortLabel: 'Vol x SMA',
    description: 'Volume vs SMA20 (×)',
    category: 'Volume',
  },
  {
    value: 'current_volume',
    label: 'Volume',
    shortLabel: 'Volume',
    description: 'Current Volume',
    category: 'Volume',
  },
  {
    value: 'volume_sma20',
    label: 'Vol SMA20',
    shortLabel: 'Vol SMA20',
    description: '20-day SMA Volume',
    category: 'Volume',
  },
  // Price fields
  {
    value: 'current_price',
    label: 'Last Price',
    shortLabel: 'Last Price',
    description: 'Latest close price',
    category: 'Price',
  },
  {
    value: 'price_change_pct',
    label: 'Change %',
    shortLabel: 'Change %',
    description: 'Daily price change percentage',
    category: 'Price',
  },
  // Moving average fields — bare labels (formula uses "Price <op> EMA 9")
  {
    value: 'ema_9',
    label: 'EMA 9',
    shortLabel: 'EMA 9',
    description: 'Current price vs EMA9',
    category: 'Moving Avg',
  },
  {
    value: 'ema_21',
    label: 'EMA 21',
    shortLabel: 'EMA 21',
    description: 'Current price vs EMA21',
    category: 'Moving Avg',
  },
  {
    value: 'ema_50',
    label: 'EMA 50',
    shortLabel: 'EMA 50',
    description: 'Current price vs EMA50',
    category: 'Moving Avg',
  },
  {
    value: 'sma_200',
    label: 'SMA 200',
    shortLabel: 'SMA 200',
    description: 'Current price vs SMA200',
    category: 'Moving Avg',
  },
  // Signal fields
  {
    value: 'has_breakout_potential',
    label: 'Breakout potential',
    shortLabel: 'Breakout potential',
    description: 'Stock approaching resistance',
    category: 'Signal',
  },
  {
    value: 'has_breakout_confirmed',
    label: 'Breakout confirmed',
    shortLabel: 'Breakout confirmed',
    description: 'Stock broke above resistance',
    category: 'Signal',
  },
  {
    value: 'has_breakdown_potential',
    label: 'Breakdown potential',
    shortLabel: 'Breakdown potential',
    description: 'Stock approaching support',
    category: 'Signal',
  },
  {
    value: 'has_breakdown_confirmed',
    label: 'Breakdown confirmed',
    shortLabel: 'Breakdown confirmed',
    description: 'Stock broke below support',
    category: 'Signal',
  },
  {
    value: 'has_bullish_rsi',
    label: 'Bullish RSI',
    shortLabel: 'Bullish RSI',
    description: 'Bullish RSI divergence detected',
    category: 'Signal',
  },
  {
    value: 'has_bearish_rsi',
    label: 'Bearish RSI',
    shortLabel: 'Bearish RSI',
    description: 'Bearish RSI divergence detected',
    category: 'Signal',
  },
]

// Ordering operators only — '=' is intentionally absent: numeric metrics never
// compare exactly equal (floats), and signals force '=' programmatically (not via
// this list). '=' stays in VALID_FILTER_OPERATORS for the signal wire format.
export const SCREENER_OPERATOR_OPTIONS: FilterOperatorOption[] = [
  { value: '>=', label: 'Greater or equal (≥)' },
  { value: '<=', label: 'Less or equal (≤)' },
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
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
  return MA_FIELDS.includes(field as (typeof MA_FIELDS)[number])
}

/** Fields allowed on either side of a field-vs-field comparison (price + MAs). */
export const PRICE_OR_MA_FIELDS = ['current_price', 'ema_9', 'ema_21', 'ema_50', 'sma_200'] as const

/** Check if a filter field can participate in a field-vs-field comparison. */
export function isPriceOrMA(field: string): boolean {
  return (PRICE_OR_MA_FIELDS as readonly string[]).includes(field)
}

/** Continuous-float fields: price, % change, the vol×SMA ratio, and the EMA/SMA
 *  moving averages. A float never lands exactly on a threshold, so these compare
 *  with strict >/< only. Integer fields (RS ranks, share volumes) keep >=/<=. */
export const FLOAT_FIELDS = [
  'current_price',
  'price_change_pct',
  'volume_vs_sma',
  'ema_9',
  'ema_21',
  'ema_50',
  'sma_200',
] as const

/** Check if a filter field is continuous-float (strict >/< only). */
export function isFloatField(field: string): boolean {
  return (FLOAT_FIELDS as readonly string[]).includes(field)
}

/** Check if a filter field is a signal type (boolean) */
export function isSignalField(field: string): boolean {
  return SIGNAL_FIELDS.includes(field as (typeof SIGNAL_FIELDS)[number])
}

/** Operator labels for MA fields (Price Above/Below MA). MA comparisons are
 *  float field-vs-field, so they use strict >/< only — no '=', '>=' or '<='. */
export const MA_OPERATOR_LABELS: Record<string, string> = {
  '>': 'Above',
  '<': 'Below',
}
