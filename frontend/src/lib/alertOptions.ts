import type { AlertConditionType, ApiAlertCondition, ApiStockAlert } from './api'

export interface AlertConditionTypeOption {
  value: AlertConditionType
  label: string
  unit: string
  placeholder: string
  helper: string
  integer?: boolean
}

export const ALERT_CONDITION_TYPES: AlertConditionTypeOption[] = [
  {
    value: 'price_above',
    label: 'Price above',
    unit: 'VND',
    placeholder: '150000',
    helper: 'Trigger when last matched price ≥ this value',
  },
  {
    value: 'price_below',
    label: 'Price below',
    unit: 'VND',
    placeholder: '90000',
    helper: 'Trigger when last matched price ≤ this value',
  },
  {
    value: 'volume_spike',
    label: 'Volume spike',
    unit: '% SMA20',
    placeholder: '200',
    helper: 'Trigger when current volume ≥ this % of SMA20',
  },
  {
    value: 'transaction_volume_spike',
    label: 'Matched volume burst',
    unit: 'shares',
    placeholder: '50000',
    integer: true,
    helper:
      'Fires when matched volume reaches this many shares between cron ticks (BUY at offer / SELL at bid only)',
  },
]

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
  return threshold.toLocaleString('en-US')
}

export function formatConditionPill(condition: ApiAlertCondition): string {
  if (condition.type === 'volume_spike') {
    return `vol ≥ ${condition.threshold}% SMA20`
  }
  if (condition.type === 'transaction_volume_spike') {
    return `matched vol ≥ ${condition.threshold.toLocaleString('en-US')} shares`
  }
  const glyph = condition.type === 'price_above' ? '>' : '<'
  return `price ${glyph} ${formatThreshold(condition.type, condition.threshold)} VND`
}

export function isAlertActive(alert: ApiStockAlert): boolean {
  return alert.conditions.some((c) => c.enabled)
}

export function countActiveConditions(alert: ApiStockAlert): { active: number; total: number } {
  const active = alert.conditions.reduce((n, c) => (c.enabled ? n + 1 : n), 0)
  return { active, total: alert.conditions.length }
}

export interface AlertValidationError {
  field: 'symbol' | 'conditions' | `condition.${number}.threshold`
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
    if (!Number.isFinite(cond.threshold) || cond.threshold <= 0) {
      errors.push({
        field: `condition.${idx}.threshold`,
        message: 'Enter a value greater than 0',
      })
    }
  })

  return errors
}

export function alertsEqual(a: ApiStockAlert[], b: ApiStockAlert[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
