import { memo, useCallback } from 'react'
import { Icons } from '../icons/Icons'
import { NumberInput } from '@/components/ui/NumberInput'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { AlertConditionType, ApiAlertCondition } from '@/lib/api'
import {
  ALERT_CONDITION_TYPES,
  getConditionOption,
  getConditionUnit,
} from '@/lib/alertOptions'

interface AlertConditionRowProps {
  condition: ApiAlertCondition
  index: number
  usedTypes: AlertConditionType[]
  hasError: boolean
  onChange: (index: number, next: ApiAlertCondition) => void
  onRemove: (index: number) => void
}

export const AlertConditionRow = memo(function AlertConditionRow({
  condition,
  index,
  usedTypes,
  hasError,
  onChange,
  onRemove,
}: AlertConditionRowProps) {
  const option = getConditionOption(condition.type)

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nextType = e.target.value as AlertConditionType
      const nextOption = getConditionOption(nextType)
      // Preserve threshold when integer constraint is satisfied; blank it otherwise.
      const next: ApiAlertCondition = {
        ...condition,
        type: nextType,
        threshold:
          nextOption?.integer && !Number.isInteger(condition.threshold)
            ? 0
            : condition.threshold,
      }
      onChange(index, next)
    },
    [index, condition, onChange]
  )

  const handleThresholdChange = useCallback(
    (value: number) => {
      onChange(index, { ...condition, threshold: value })
    },
    [index, condition, onChange]
  )

  const handleEnabledChange = useCallback(
    (next: boolean) => {
      onChange(index, { ...condition, enabled: next })
    },
    [index, condition, onChange]
  )

  const handleRemove = useCallback(() => {
    onRemove(index)
  }, [index, onRemove])

  const dimmed = !condition.enabled

  return (
    <div className={cn('flex flex-col gap-1.5', dimmed && 'opacity-60')}>
      <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-center">
        <select
          className="px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-dim)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]"
          value={condition.type}
          onChange={handleTypeChange}
        >
          {ALERT_CONDITION_TYPES.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.value !== condition.type && usedTypes.includes(opt.value)}
            >
              {opt.label}
            </option>
          ))}
        </select>

        <NumberInput
          className={cn(
            'px-3 py-2 bg-[var(--bg-deep)] border rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)]',
            hasError ? 'border-[var(--neon-bear)]' : 'border-[var(--border-dim)]'
          )}
          value={condition.threshold}
          onChange={handleThresholdChange}
          min={0}
          step={option?.integer ? '1' : undefined}
          placeholder={option?.placeholder}
          disabled={dimmed}
        />

        <span className="text-xs text-[var(--text-muted)] font-mono whitespace-nowrap">
          {getConditionUnit(condition.type)}
        </span>

        <button
          type="button"
          onClick={handleRemove}
          aria-label="Remove condition"
          className="w-8 h-8 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--neon-bear)] [&_svg]:w-4 [&_svg]:h-4"
        >
          <Icons.Trash2 />
        </button>

        <Switch
          checked={condition.enabled}
          onCheckedChange={handleEnabledChange}
          aria-label={`Enable ${condition.type} condition`}
        />
      </div>
      {option?.helper && (
        <span className="text-[11px] text-[var(--text-muted)] pl-1">{option.helper}</span>
      )}
    </div>
  )
})
