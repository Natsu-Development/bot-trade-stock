import type { AlertConditionType, ApiAlertCondition, ApiStockAlert } from './api'

/** Functional grouping of condition types, mirrors a trading-platform alert builder. */
export type ConditionCategoryId = 'price' | 'volume' | 'ma_cross' | 'trendline' | 'rsi'

/** Directional bias used for color accents (green / red / neutral cyan). */
export type ConditionSentiment = 'bull' | 'bear' | 'neutral'

export interface AlertConditionTypeOption {
  value: AlertConditionType
  label: string
  unit: string
  placeholder: string
  helper: string
  integer?: boolean
  hasThreshold: boolean
  hasReference?: boolean
  category: ConditionCategoryId
  sentiment: ConditionSentiment
}

export const ALERT_CONDITION_TYPES: AlertConditionTypeOption[] = [
  {
    value: 'price_above',
    label: 'Price above',
    unit: 'kVND',
    placeholder: '18.5',
    helper: 'Trigger when last matched price ≥ this value. Enter in thousands of VND (e.g. 18.5 = 18,500 VND).',
    hasThreshold: true,
    category: 'price',
    sentiment: 'bull',
  },
  {
    value: 'price_below',
    label: 'Price below',
    unit: 'kVND',
    placeholder: '17.0',
    helper: 'Trigger when last matched price ≤ this value. Enter in thousands of VND (e.g. 17.0 = 17,000 VND).',
    hasThreshold: true,
    category: 'price',
    sentiment: 'bear',
  },
  {
    value: 'volume_spike',
    label: 'Volume spike',
    unit: '% SMA20',
    placeholder: '200',
    helper: 'Trigger when current volume ≥ this % of SMA20',
    hasThreshold: true,
    category: 'volume',
    sentiment: 'neutral',
  },
  {
    value: 'transaction_volume_spike',
    label: 'Matched volume burst',
    unit: 'shares',
    placeholder: '50000',
    integer: true,
    helper:
      'Fires when matched volume reaches this many shares between cron ticks (BUY at offer / SELL at bid only)',
    hasThreshold: true,
    category: 'volume',
    sentiment: 'neutral',
  },
  {
    value: 'trendline_breakout',
    label: 'Trendline breakout (potential)',
    unit: '',
    placeholder: '',
    helper: 'Fires when price approaches a resistance trendline (potential breakout zone)',
    hasThreshold: false,
    category: 'trendline',
    sentiment: 'bull',
  },
  {
    value: 'trendline_breakdown',
    label: 'Trendline breakdown (potential)',
    unit: '',
    placeholder: '',
    helper: 'Fires when price approaches a support trendline (potential breakdown zone)',
    hasThreshold: false,
    category: 'trendline',
    sentiment: 'bear',
  },
  {
    value: 'price_cross_above',
    label: 'Price crosses above MA',
    unit: '',
    placeholder: '',
    helper: 'Fires when price crosses above the selected moving average (EMA9/EMA21/EMA50/SMA200)',
    hasThreshold: false,
    hasReference: true,
    category: 'ma_cross',
    sentiment: 'bull',
  },
  {
    value: 'price_cross_below',
    label: 'Price crosses below MA',
    unit: '',
    placeholder: '',
    helper: 'Fires when price crosses below the selected moving average (EMA9/EMA21/EMA50/SMA200)',
    hasThreshold: false,
    hasReference: true,
    category: 'ma_cross',
    sentiment: 'bear',
  },
  {
    value: 'bullish_divergence',
    label: 'Bullish RSI divergence',
    unit: '',
    placeholder: '',
    helper: 'Fires when a bullish RSI divergence is detected (evaluated by the analyze job)',
    hasThreshold: false,
    category: 'rsi',
    sentiment: 'bull',
  },
  {
    value: 'bearish_divergence',
    label: 'Bearish RSI divergence',
    unit: '',
    placeholder: '',
    helper: 'Fires when a bearish RSI divergence is detected (evaluated by the analyze job)',
    hasThreshold: false,
    category: 'rsi',
    sentiment: 'bear',
  },
  {
    value: 'bullish_divergence_early',
    label: 'Bullish RSI divergence (early)',
    unit: '',
    placeholder: '',
    helper: 'Fires when an early (forming) bullish RSI divergence is detected — independent of the confirmed one',
    hasThreshold: false,
    category: 'rsi',
    sentiment: 'bull',
  },
  {
    value: 'bearish_divergence_early',
    label: 'Bearish RSI divergence (early)',
    unit: '',
    placeholder: '',
    helper: 'Fires when an early (forming) bearish RSI divergence is detected — independent of the confirmed one',
    hasThreshold: false,
    category: 'rsi',
    sentiment: 'bear',
  },
  {
    value: 'trendline_breakout_mtf',
    label: 'Trendline breakout (all timeframes)',
    unit: '',
    placeholder: '',
    helper: 'Fires when a potential trendline breakout is detected on any configured timeframe (evaluated by the analyze job)',
    hasThreshold: false,
    category: 'trendline',
    sentiment: 'bull',
  },
  {
    value: 'trendline_breakdown_mtf',
    label: 'Trendline breakdown (all timeframes)',
    unit: '',
    placeholder: '',
    helper: 'Fires when a potential trendline breakdown is detected on any configured timeframe (evaluated by the analyze job)',
    hasThreshold: false,
    category: 'trendline',
    sentiment: 'bear',
  },
]

export const MA_REFERENCE_OPTIONS: Array<{ value: 'ema9' | 'ema21' | 'ema50' | 'sma200'; label: string }> = [
  { value: 'ema9', label: 'EMA 9' },
  { value: 'ema21', label: 'EMA 21' },
  { value: 'ema50', label: 'EMA 50' },
  { value: 'sma200', label: 'SMA 200' },
]

export interface ConditionCategory {
  id: ConditionCategoryId
  label: string
  /** Name of an icon exported by components/icons/Icons. */
  iconName: string
  types: AlertConditionType[]
}

/** Ordered categories for the grouped condition picker (TradingView-style builder). */
export const CONDITION_CATEGORIES: ConditionCategory[] = [
  { id: 'price', label: 'Price', iconName: 'TrendUp', types: ['price_above', 'price_below'] },
  { id: 'volume', label: 'Volume', iconName: 'BarChart', types: ['volume_spike', 'transaction_volume_spike'] },
  {
    id: 'ma_cross',
    label: 'Moving Average',
    iconName: 'Sliders',
    types: ['price_cross_above', 'price_cross_below'],
  },
  {
    id: 'trendline',
    label: 'Trendline',
    iconName: 'Chart',
    types: ['trendline_breakout', 'trendline_breakdown', 'trendline_breakout_mtf', 'trendline_breakdown_mtf'],
  },
  {
    id: 'rsi',
    label: 'RSI Divergence',
    iconName: 'Zap',
    types: ['bullish_divergence', 'bullish_divergence_early', 'bearish_divergence', 'bearish_divergence_early'],
  },
]

export function getConditionCategory(type: AlertConditionType): ConditionCategory | undefined {
  return CONDITION_CATEGORIES.find((c) => c.types.includes(type))
}

export function getConditionSentiment(type: AlertConditionType): ConditionSentiment {
  return getConditionOption(type)?.sentiment ?? 'neutral'
}

export function getMAReferenceLabel(reference?: string): string {
  return MA_REFERENCE_OPTIONS.find((r) => r.value === reference)?.label ?? reference?.toUpperCase() ?? 'MA'
}

/**
 * Plain-English description of what a condition will trigger on, for the live
 * builder summary (e.g. "FPT price rises to or above 95,000 VND"). Pure display
 * helper — never used for validation or persistence.
 */
export function describeCondition(cond: ApiAlertCondition, symbol: string): string {
  const sym = symbol.trim().toUpperCase() || 'this stock'
  const ma = getMAReferenceLabel(cond.reference)
  switch (cond.type) {
    case 'price_above':
      return `${sym} price rises to or above ${formatThreshold(cond.type, cond.threshold)} kVND`
    case 'price_below':
      return `${sym} price falls to or below ${formatThreshold(cond.type, cond.threshold)} kVND`
    case 'volume_spike':
      return `${sym} volume reaches ${cond.threshold}% of its 20-day average`
    case 'transaction_volume_spike':
      return `${sym} matched volume reaches ${cond.threshold.toLocaleString('en-US')} shares between checks`
    case 'price_cross_above':
      return `${sym} price crosses above its ${ma}`
    case 'price_cross_below':
      return `${sym} price crosses below its ${ma}`
    case 'trendline_breakout':
      return `${sym} approaches a resistance trendline (potential breakout)`
    case 'trendline_breakdown':
      return `${sym} approaches a support trendline (potential breakdown)`
    case 'trendline_breakout_mtf':
      return `${sym} shows a potential trendline breakout on any timeframe`
    case 'trendline_breakdown_mtf':
      return `${sym} shows a potential trendline breakdown on any timeframe`
    case 'bullish_divergence':
      return `${sym} forms a bullish RSI divergence`
    case 'bearish_divergence':
      return `${sym} forms a bearish RSI divergence`
    case 'bullish_divergence_early':
      return `${sym} forms an early bullish RSI divergence`
    case 'bearish_divergence_early':
      return `${sym} forms an early bearish RSI divergence`
    default:
      return getConditionLabel(cond.type)
  }
}

const ALERT_CONDITION_TYPE_LABELS: Record<AlertConditionType, string> = ALERT_CONDITION_TYPES.reduce(
  (acc, opt) => {
    acc[opt.value] = opt.label
    return acc
  },
  {} as Record<AlertConditionType, string>
)

const ALERT_CONDITION_TYPE_UNITS: Record<AlertConditionType, string> = ALERT_CONDITION_TYPES.reduce(
  (acc, opt) => {
    acc[opt.value] = opt.unit
    return acc
  },
  {} as Record<AlertConditionType, string>
)

export function getConditionLabel(type: AlertConditionType): string {
  return ALERT_CONDITION_TYPE_LABELS[type] ?? type
}

export function getConditionUnit(type: AlertConditionType): string {
  return ALERT_CONDITION_TYPE_UNITS[type] ?? ''
}

export function getConditionOption(type: AlertConditionType): AlertConditionTypeOption | undefined {
  return ALERT_CONDITION_TYPES.find((o) => o.value === type)
}

export function formatThreshold(type: AlertConditionType, threshold: number): string {
  if (type === 'volume_spike') {
    return `${threshold}%`
  }
  if (type === 'price_above' || type === 'price_below') {
    // Canonical thousand-VND scale: user enters 18.5 meaning 18,500 VND.
    // Two decimals preserve the precision actually configured.
    return threshold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return threshold.toLocaleString('en-US')
}

export function formatConditionPill(condition: ApiAlertCondition): string {
  if (condition.type === 'volume_spike') {
    return `vol ≥ ${condition.threshold}% SMA20`
  }
  if (condition.type === 'transaction_volume_spike') {
    return `matched vol ≥ ${condition.threshold.toLocaleString('en-US')} shares`
  }
  if (condition.type === 'price_cross_above') {
    return `price crosses above ${condition.reference?.toUpperCase() ?? 'MA'}`
  }
  if (condition.type === 'price_cross_below') {
    return `price crosses below ${condition.reference?.toUpperCase() ?? 'MA'}`
  }
  if (condition.type === 'trendline_breakout') return 'trendline breakout (potential)'
  if (condition.type === 'trendline_breakdown') return 'trendline breakdown (potential)'
  if (condition.type === 'bullish_divergence') return 'bullish RSI divergence'
  if (condition.type === 'bearish_divergence') return 'bearish RSI divergence'
  if (condition.type === 'bullish_divergence_early') return 'bullish RSI divergence (early)'
  if (condition.type === 'bearish_divergence_early') return 'bearish RSI divergence (early)'
  if (condition.type === 'trendline_breakout_mtf') return 'trendline breakout (all timeframes)'
  if (condition.type === 'trendline_breakdown_mtf') return 'trendline breakdown (all timeframes)'
  const glyph = condition.type === 'price_above' ? '>' : '<'
  return `price ${glyph} ${formatThreshold(condition.type, condition.threshold)} kVND`
}

export function isAlertActive(alert: ApiStockAlert): boolean {
  return alert.conditions.some((c) => c.enabled)
}

export function countActiveConditions(alert: ApiStockAlert): { active: number; total: number } {
  const active = alert.conditions.reduce((n, c) => (c.enabled ? n + 1 : n), 0)
  return { active, total: alert.conditions.length }
}

export interface AlertValidationError {
  field: 'symbol' | 'conditions' | `condition.${number}.threshold` | `condition.${number}.reference`
  message: string
}

export function validateAlert(
  draft: ApiStockAlert,
  existingSymbols: string[]
): AlertValidationError[] {
  const errors: AlertValidationError[] = []
  const symbol = draft.symbol.trim().toUpperCase()

  if (!symbol) {
    errors.push({ field: 'symbol', message: 'Pick a stock symbol' })
  } else if (existingSymbols.includes(symbol)) {
    errors.push({ field: 'symbol', message: 'An alert for this symbol already exists' })
  }

  if (draft.conditions.length === 0) {
    errors.push({ field: 'conditions', message: 'Add at least one condition' })
  }

  draft.conditions.forEach((cond, idx) => {
    // Only enabled conditions are validated. A paused condition (toggled off, or
    // auto-disabled after firing) retains its value and must never block saving.
    if (!cond.enabled) return

    const opt = getConditionOption(cond.type)

    if (opt?.hasThreshold) {
      if (!Number.isFinite(cond.threshold) || cond.threshold <= 0) {
        errors.push({
          field: `condition.${idx}.threshold`,
          message: 'Enter a value greater than 0',
        })
      }
    }

    if (opt?.hasReference) {
      const validRefs = ['ema9', 'ema21', 'ema50', 'sma200']
      if (!cond.reference || !validRefs.includes(cond.reference)) {
        errors.push({
          field: `condition.${idx}.reference`,
          message: 'Select a moving average reference',
        })
      }
    }
  })

  return errors
}

export function alertsEqual(a: ApiStockAlert[], b: ApiStockAlert[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
