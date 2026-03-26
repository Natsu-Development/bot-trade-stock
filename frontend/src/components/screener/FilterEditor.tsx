import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import { Button } from '@/components/ui/button'
import type { DynamicFilter, FilterField, FilterOperator, FilterFieldOption, FilterOperatorOption } from '../../types'

interface FilterEditorProps {
  isOpen: boolean
  filter: DynamicFilter | null
  fieldOptions: FilterFieldOption[]
  operatorOptions: FilterOperatorOption[]
  onSave: (filter: DynamicFilter) => void
  onClose: () => void
}

const operatorSymbols: Record<string, string> = {
  '>=': '≥',
  '<=': '≤',
  '>': '>',
  '<': '<',
  '=': '=',
}

const DEFAULT_FIELD: FilterField = 'rs_52w'
const DEFAULT_OPERATOR: FilterOperator = '>='
const DEFAULT_VALUE = 70

export const FilterEditor = memo(function FilterEditor({
  isOpen,
  filter,
  fieldOptions,
  operatorOptions,
  onSave,
  onClose,
}: FilterEditorProps) {
  const initField = filter?.field || DEFAULT_FIELD
  const initOp = filter?.operator || DEFAULT_OPERATOR
  const initValue = (filter?.value as number) || DEFAULT_VALUE

  const [field, setField] = useState<FilterField>(initField)
  const [operator, setOperator] = useState<FilterOperator>(initOp)
  const [value, setValue] = useState<number>(initValue)
  const [localValue, setLocalValue] = useState(initValue.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const handleSave = useCallback(() => {
    const parsed = parseFloat(localValue)
    const finalValue = isNaN(parsed) ? value : parsed

    const newFilter: DynamicFilter = {
      id: filter?.id || `filter_${Date.now()}`,
      field,
      operator,
      value: finalValue,
    }

    onSave(newFilter)
    onClose()
  }, [filter, field, operator, value, localValue, onSave, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [handleSave, onClose])

  const handleFieldChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setField(e.target.value as FilterField)
  }, [])

  const handleOperatorChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setOperator(e.target.value as FilterOperator)
  }, [])

  const handleValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setLocalValue(raw)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed)) {
      setValue(parsed)
    }
  }, [])

  const handleValueBlur = useCallback(() => {
    const parsed = parseFloat(localValue)
    if (isNaN(parsed)) {
      setLocalValue(value.toString())
    } else {
      setValue(parsed)
      setLocalValue(parsed.toString())
    }
  }, [localValue, value])

  const handleBackdropClick = useCallback(() => {
    onClose()
  }, [onClose])

  const handleModalClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const fieldOption = fieldOptions.find(o => o.value === field)

  if (!isOpen) return null

  const inputBaseStyles = cn(
    'px-3 py-2.5 bg-[var(--bg-deep)] border border-[var(--border-dim)] rounded text-sm text-[var(--text-primary)] transition-all duration-150',
    'focus:outline-none focus:border-[var(--neon-cyan)] focus:ring-[3px] focus:ring-[var(--neon-cyan-dim)]'
  )

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.4)] w-full max-w-[420px] animate-slide-in-from-bottom"
        onClick={handleModalClick}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {filter ? 'Edit Filter' : 'Add Filter'}
          </h3>
          <button
            className="w-8 h-8 flex items-center justify-center bg-transparent border-none rounded text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            onClick={onClose}
            type="button"
          >
            <Icons.X />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Field</label>
            <select
              className={inputBaseStyles}
              value={field}
              onChange={handleFieldChange}
            >
              {fieldOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Operator</label>
            <select
              className={inputBaseStyles}
              value={operator}
              onChange={handleOperatorChange}
            >
              {operatorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Value</label>
            <input
              ref={inputRef}
              type="number"
              className={inputBaseStyles}
              value={localValue}
              onChange={handleValueChange}
              onBlur={handleValueBlur}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="p-3 bg-[var(--bg-deep)] border border-[var(--border-dim)] rounded flex items-center justify-center gap-2">
            <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase">Preview</span>
            <span className="text-sm font-medium text-[var(--neon-cyan)] font-mono">
              {fieldOption?.shortLabel || field} {operatorSymbols[operator]} {value}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <Button
            variant="secondary"
            onClick={onClose}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            type="button"
          >
            {filter ? 'Update' : 'Add'} Filter
          </Button>
        </div>
      </div>
    </div>
  )
})
