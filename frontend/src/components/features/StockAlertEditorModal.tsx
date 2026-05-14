import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Icons } from '../icons/Icons'
import { Button } from '@/components/ui/button'
import { AlertConditionRow } from './AlertConditionRow'
import { api, type ApiAlertCondition, type ApiStockAlert, type AlertConditionType } from '@/lib/api'
import {
  ALERT_CONDITION_TYPES,
  validateAlert,
  type AlertValidationError,
} from '@/lib/alertOptions'

interface StockAlertEditorModalProps {
  initial: ApiStockAlert | null
  existingSymbols: string[]
  onSave: (alert: ApiStockAlert) => void
  onClose: () => void
}

const DEFAULT_DRAFT: ApiStockAlert = {
  symbol: '',
  conditions: [],
}

export const StockAlertEditorModal = memo(function StockAlertEditorModal({
  initial,
  existingSymbols,
  onSave,
  onClose,
}: StockAlertEditorModalProps) {
  const isEditing = initial !== null
  const [draft, setDraft] = useState<ApiStockAlert>(initial ?? DEFAULT_DRAFT)
  const [errors, setErrors] = useState<AlertValidationError[]>([])
  const [stockSymbols, setStockSymbols] = useState<string[]>([])
  const [symbolQuery, setSymbolQuery] = useState(initial?.symbol ?? '')
  const [symbolListLoading, setSymbolListLoading] = useState(false)
  const [symbolFocus, setSymbolFocus] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSymbolListLoading(true)
    api
      .filterStocks({})
      .then((res) => {
        if (cancelled) return
        setStockSymbols(res.stocks.map((s) => s.symbol).sort())
      })
      .catch(() => {
        // Silent: validation still catches invalid symbols on save via backend.
      })
      .finally(() => {
        if (!cancelled) setSymbolListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const suggestions = useMemo(() => {
    const q = symbolQuery.trim().toUpperCase()
    if (!q) return stockSymbols.slice(0, 8)
    return stockSymbols.filter((s) => s.startsWith(q)).slice(0, 8)
  }, [symbolQuery, stockSymbols])

  const usedTypes = useMemo(
    () => draft.conditions.map((c) => c.type),
    [draft.conditions]
  )

  const allConditionsDisabled = useMemo(
    () => draft.conditions.length > 0 && draft.conditions.every((c) => !c.enabled),
    [draft.conditions]
  )

  // Symbols already taken by other alerts (exclude the one being edited)
  const reservedSymbols = useMemo(() => {
    const original = initial?.symbol?.toUpperCase()
    return existingSymbols.filter((s) => s.toUpperCase() !== original)
  }, [existingSymbols, initial])

  const symbolError = errors.find((e) => e.field === 'symbol')
  const conditionsError = errors.find((e) => e.field === 'conditions')

  const handleSymbolChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.toUpperCase()
    setSymbolQuery(next)
    setDraft((prev) => ({ ...prev, symbol: next }))
  }, [])

  const handleSymbolPick = useCallback((symbol: string) => {
    setSymbolQuery(symbol)
    setDraft((prev) => ({ ...prev, symbol }))
    setSymbolFocus(false)
  }, [])

  const handleAddCondition = useCallback(() => {
    setDraft((prev) => {
      const taken = new Set(prev.conditions.map((c) => c.type))
      const nextType: AlertConditionType =
        (ALERT_CONDITION_TYPES.find((o) => !taken.has(o.value))?.value as AlertConditionType) ??
        'price_above'
      return {
        ...prev,
        conditions: [...prev.conditions, { type: nextType, threshold: 0, enabled: true }],
      }
    })
  }, [])

  const handleConditionChange = useCallback((index: number, next: ApiAlertCondition) => {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? next : c)),
    }))
  }, [])

  const handleConditionRemove = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }))
  }, [])

  const handleSave = useCallback(() => {
    const trimmed: ApiStockAlert = { ...draft, symbol: draft.symbol.trim().toUpperCase() }
    const found = validateAlert(trimmed, reservedSymbols)
    if (found.length > 0) {
      setErrors(found)
      return
    }
    onSave(trimmed)
  }, [draft, reservedSymbols, onSave])

  const handleBackdropClick = useCallback(() => onClose(), [onClose])
  const handleModalClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), [])

  const canSubmit = draft.symbol.trim().length > 0 && draft.conditions.length > 0

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.4)] w-full max-w-[560px] max-h-[90vh] overflow-auto"
        onClick={handleModalClick}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {isEditing ? 'Edit Alert' : 'Create Alert'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center bg-transparent border-none rounded text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Icons.X />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Symbol */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Symbol
            </label>
            <input
              type="text"
              className={`px-3 py-2.5 bg-[var(--bg-deep)] border rounded text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)] focus:ring-[3px] focus:ring-[var(--neon-cyan-dim)] ${
                symbolError ? 'border-[var(--neon-bear)]' : 'border-[var(--border-dim)]'
              }`}
              value={symbolQuery}
              onChange={handleSymbolChange}
              onFocus={() => setSymbolFocus(true)}
              onBlur={() => setTimeout(() => setSymbolFocus(false), 120)}
              placeholder={symbolListLoading ? 'Loading symbols…' : 'Type ticker (e.g., FPT)'}
              disabled={isEditing}
              autoFocus={!isEditing}
            />
            {symbolFocus && suggestions.length > 0 && (
              <ul
                className="absolute top-full left-0 right-0 mt-1 max-h-[200px] overflow-auto bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded shadow-[0_10px_30px_rgba(0,0,0,0.4)] z-10"
                role="listbox"
              >
                {suggestions.map((s) => (
                  <li
                    key={s}
                    role="option"
                    aria-selected={s === draft.symbol}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSymbolPick(s)
                    }}
                    className="px-3 py-2 text-sm font-mono cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
            {symbolError && (
              <span className="text-xs text-[var(--neon-bear)]">{symbolError.message}</span>
            )}
          </div>

          {/* Conditions */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Conditions
              </label>
              <button
                type="button"
                onClick={handleAddCondition}
                disabled={draft.conditions.length >= ALERT_CONDITION_TYPES.length}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--neon-cyan)] bg-transparent border border-dashed border-[var(--neon-cyan-dim)] rounded cursor-pointer hover:bg-[var(--neon-cyan-dim)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icons.Plus className="w-3 h-3" />
                Add Condition
              </button>
            </div>

            {draft.conditions.length === 0 ? (
              <div className="flex items-center justify-center py-4 text-[var(--text-muted)] text-xs border border-dashed border-[var(--border-dim)] rounded">
                No conditions added
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {draft.conditions.map((cond, idx) => (
                  <AlertConditionRow
                    key={idx}
                    condition={cond}
                    index={idx}
                    usedTypes={usedTypes}
                    hasError={errors.some((e) => e.field === `condition.${idx}.threshold`)}
                    onChange={handleConditionChange}
                    onRemove={handleConditionRemove}
                  />
                ))}
              </div>
            )}
            {conditionsError && (
              <span className="text-xs text-[var(--neon-bear)]">{conditionsError.message}</span>
            )}
            <span className="text-xs text-[var(--text-muted)]">
              Each condition fires independently and auto-disables itself after firing.
            </span>
          </div>

          {allConditionsDisabled && (
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-[var(--neon-warn-dim,var(--border-dim))] bg-[var(--bg-deep)] text-xs text-[var(--text-warning,var(--text-muted))]">
              <span aria-hidden>⚠</span>
              <span>No conditions active — alert will be paused</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSubmit}>
            {isEditing ? 'Update' : 'Create'} Alert
          </Button>
        </div>
      </div>
    </div>
  )
})
