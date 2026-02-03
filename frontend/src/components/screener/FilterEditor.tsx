import { useState, useEffect, KeyboardEvent } from 'react'
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

type ValueState = number | ''

export function FilterEditor({
  isOpen,
  filter,
  fieldOptions,
  operatorOptions,
  onSave,
  onClose,
}: FilterEditorProps) {
  const [field, setField] = useState<FilterField>(filter?.field || 'rs_52w')
  const [operator, setOperator] = useState<FilterOperator>(filter?.operator || '>=')
  const [value, setValue] = useState<ValueState>(filter?.value as number || 70)

  useEffect(() => {
    if (filter) {
      setField(filter.field)
      setOperator(filter.operator)
      setValue(filter.value as number)
    }
  }, [filter])

  const handleSave = () => {
    if (value === '' || isNaN(Number(value))) return

    const newFilter: DynamicFilter = {
      id: filter?.id || `filter_${Date.now()}`,
      field,
      operator,
      value: Number(value),
    }

    onSave(newFilter)
    onClose()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const getFieldOption = () => fieldOptions.find(o => o.value === field)
  const fieldOption = getFieldOption()

  if (!isOpen) return null

  const inputBaseStyles = cn(
    'px-3 py-2.5 bg-[var(--bg-deep)] border border-[var(--border-dim)] rounded text-sm text-[var(--text-primary)] transition-all duration-150',
    'focus:outline-none focus:border-[var(--neon-cyan)] focus:ring-[3px] focus:ring-[var(--neon-cyan-dim)]'
  )

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.4)] w-full max-w-[420px] animate-slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
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
              onChange={(e) => setField(e.target.value as FilterField)}
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
              onChange={(e) => setOperator(e.target.value as FilterOperator)}
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
              type="number"
              className={inputBaseStyles}
              value={value}
              onChange={(e) => setValue(e.target.value ? parseFloat(e.target.value) : '')}
              onKeyDown={handleKeyDown}
              placeholder="Enter value"
              autoFocus
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
            disabled={value === '' || isNaN(Number(value))}
            type="button"
          >
            {filter ? 'Update' : 'Add'} Filter
          </Button>
        </div>
      </div>
    </div>
  )
}
