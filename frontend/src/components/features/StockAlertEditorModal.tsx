import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Icons } from '../icons/Icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { NumberInput } from '@/components/ui/NumberInput'
import { api, type ApiAlertCondition, type ApiStockAlert, type AlertConditionType } from '@/lib/api'
import {
  ALERT_CONDITION_TYPES,
  CONDITION_CATEGORIES,
  MA_REFERENCE_OPTIONS,
  validateAlert,
  describeCondition,
  getConditionSentiment,
  getConditionOption,
  type AlertValidationError,
} from '@/lib/alertOptions'
import { SENTIMENT_BAR, SENTIMENT_DOT, SENTIMENT_TEXT } from '@/lib/alertStyles'
import { cn } from '@/lib/utils'

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

// ---------------------------------------------------------------------------
// Sentiment styling maps (shared SENTIMENT_DOT/TEXT/BAR live in lib/alertStyles)
// ---------------------------------------------------------------------------
const SENTIMENT_CHIP_ON: Record<string, string> = {
  bull: 'bg-[var(--neon-bull)] text-[var(--bg-void)] border-[var(--neon-bull)] shadow-[0_0_8px_var(--neon-bull)]',
  bear: 'bg-[var(--neon-bear)] text-[var(--bg-void)] border-[var(--neon-bear)] shadow-[0_0_8px_var(--neon-bear)]',
  neutral: 'bg-[var(--neon-cyan)] text-[var(--bg-void)] border-[var(--neon-cyan)] shadow-[0_0_8px_var(--neon-cyan)]',
}

const SENTIMENT_CHIP_OFF =
  'bg-transparent text-[var(--text-muted)] border-[var(--border-glow)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'

// ---------------------------------------------------------------------------
// Category icon helper
// ---------------------------------------------------------------------------
function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = Icons[name as keyof typeof Icons]
  if (!Icon) return null
  return <Icon className={className} />
}

// ---------------------------------------------------------------------------
// Individual fixed condition rows
// ---------------------------------------------------------------------------

interface ThresholdRowProps {
  type: AlertConditionType
  draft: ApiStockAlert
  errors: AlertValidationError[]
  getCond: (type: AlertConditionType, ref?: string) => ApiAlertCondition | undefined
  isEnabled: (type: AlertConditionType, ref?: string) => boolean
  setEnabled: (type: AlertConditionType, ref: string | undefined, on: boolean) => void
  setThreshold: (type: AlertConditionType, ref: string | undefined, value: number) => void
  condIdx: () => number
}

const ThresholdRow = memo(function ThresholdRow({
  type,
  errors,
  getCond,
  isEnabled,
  setEnabled,
  setThreshold,
  condIdx,
}: ThresholdRowProps) {
  const opt = getConditionOption(type)
  const sentiment = getConditionSentiment(type)
  const cond = getCond(type)
  const enabled = isEnabled(type)
  const threshold = cond?.threshold ?? 0
  const idx = condIdx()
  const hasError =
    idx >= 0 &&
    errors.some((e) => e.field === `condition.${idx}.threshold`)

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-md border overflow-hidden transition-colors duration-150 pl-4 pr-3 py-2.5',
        enabled
          ? 'border-[var(--border-dim)] hover:border-[var(--border-glow)]'
          : 'border-[var(--border-dim)] opacity-55'
      )}
    >
      {/* Sentiment accent bar */}
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-[3px]', SENTIMENT_BAR[sentiment])}
        aria-hidden="true"
      />

      {/* Label + helper */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium leading-snug', SENTIMENT_TEXT[sentiment])}>
          {opt?.label}
        </p>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
          {opt?.helper}
        </p>
      </div>

      {/* Value input */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <NumberInput
          className={cn(
            'w-24 px-2 py-1 bg-[var(--bg-deep)] border rounded text-xs font-mono text-right text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)] focus:ring-1 focus:ring-[var(--neon-cyan-dim)] transition-colors duration-150',
            hasError ? 'border-[var(--neon-bear)]' : 'border-[var(--border-dim)]'
          )}
          value={threshold}
          onChange={(v) => setThreshold(type, undefined, v)}
          min={0}
          step={opt?.integer ? '1' : undefined}
          placeholder={opt?.placeholder}
          aria-label={`${opt?.label} threshold`}
        />
        {opt?.unit && (
          <span className="text-[10px] text-[var(--text-muted)] font-mono whitespace-nowrap">
            {opt.unit}
          </span>
        )}
      </div>

      {/* Enable switch */}
      <div className="shrink-0 mt-0.5">
        <Switch
          checked={enabled}
          onCheckedChange={(on) => setEnabled(type, undefined, on)}
          aria-label={`Enable ${opt?.label}`}
        />
      </div>
    </div>
  )
})

interface SignalRowProps {
  type: AlertConditionType
  isEnabled: (type: AlertConditionType, ref?: string) => boolean
  setEnabled: (type: AlertConditionType, ref: string | undefined, on: boolean) => void
}

const SignalRow = memo(function SignalRow({ type, isEnabled, setEnabled }: SignalRowProps) {
  const opt = getConditionOption(type)
  const sentiment = getConditionSentiment(type)
  const enabled = isEnabled(type)

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-md border overflow-hidden transition-colors duration-150 pl-4 pr-3 py-2.5',
        enabled
          ? 'border-[var(--border-dim)] hover:border-[var(--border-glow)]'
          : 'border-[var(--border-dim)] opacity-55'
      )}
    >
      {/* Sentiment accent bar */}
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-[3px]', SENTIMENT_BAR[sentiment])}
        aria-hidden="true"
      />

      {/* Label + helper */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium leading-snug', SENTIMENT_TEXT[sentiment])}>
          {opt?.label}
        </p>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
          {opt?.helper}
        </p>
      </div>

      {/* Signal pill */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-deep)] border border-[var(--border-dim)] text-[10px] text-[var(--text-muted)] italic font-mono">
          <Icons.Zap className="w-2.5 h-2.5 flex-shrink-0" />
          Signal
        </span>
      </div>

      {/* Enable switch */}
      <div className="shrink-0 mt-0.5">
        <Switch
          checked={enabled}
          onCheckedChange={(on) => setEnabled(type, undefined, on)}
          aria-label={`Enable ${opt?.label}`}
        />
      </div>
    </div>
  )
})

interface MARowProps {
  type: AlertConditionType
  isEnabled: (type: AlertConditionType, ref?: string) => boolean
  setEnabled: (type: AlertConditionType, ref: string | undefined, on: boolean) => void
}

const MARow = memo(function MARow({ type, isEnabled, setEnabled }: MARowProps) {
  const opt = getConditionOption(type)
  const sentiment = getConditionSentiment(type)
  const anyEnabled = MA_REFERENCE_OPTIONS.some((ref) => isEnabled(type, ref.value))

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-md border overflow-hidden transition-colors duration-150 pl-4 pr-3 py-2.5',
        anyEnabled
          ? 'border-[var(--border-dim)] hover:border-[var(--border-glow)]'
          : 'border-[var(--border-dim)] opacity-55'
      )}
    >
      {/* Sentiment accent bar */}
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-[3px]', SENTIMENT_BAR[sentiment])}
        aria-hidden="true"
      />

      {/* Label + helper */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium leading-snug', SENTIMENT_TEXT[sentiment])}>
          {opt?.label}
        </p>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
          {opt?.helper}
        </p>

        {/* MA chip toggles */}
        <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label={`${opt?.label} moving averages`}>
          {MA_REFERENCE_OPTIONS.map((ref) => {
            const on = isEnabled(type, ref.value)
            return (
              <button
                key={ref.value}
                type="button"
                onClick={() => setEnabled(type, ref.value, !on)}
                aria-pressed={on}
                aria-label={`${on ? 'Disable' : 'Enable'} ${ref.label} for ${opt?.label}`}
                className={cn(
                  'px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-semibold transition-all duration-150 cursor-pointer',
                  on ? SENTIMENT_CHIP_ON[sentiment] : SENTIMENT_CHIP_OFF
                )}
              >
                {ref.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

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
  const [activeSuggestion, setActiveSuggestion] = useState(-1)

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

  // ---------------------------------------------------------------------------
  // State helpers — implement exactly as specified
  // ---------------------------------------------------------------------------

  const getCond = useCallback(
    (type: AlertConditionType, ref?: string): ApiAlertCondition | undefined => {
      return draft.conditions.find(
        (c) => c.type === type && (c.reference ?? '') === (ref ?? '')
      )
    },
    [draft.conditions]
  )

  const isEnabled = useCallback(
    (type: AlertConditionType, ref?: string): boolean => {
      return getCond(type, ref)?.enabled === true
    },
    [getCond]
  )

  const setEnabled = useCallback(
    (type: AlertConditionType, ref: string | undefined, on: boolean) => {
      setDraft((prev) => {
        const conditions = [...prev.conditions]
        const idx = conditions.findIndex(
          (c) => c.type === type && (c.reference ?? '') === (ref ?? '')
        )
        if (idx >= 0) {
          // Condition exists — update enabled, keep threshold/reference intact
          conditions[idx] = { ...conditions[idx], enabled: on }
        } else if (on) {
          // Doesn't exist yet and we're turning it on — create it
          conditions.push({
            type,
            threshold: 0,
            reference: ref as ApiAlertCondition['reference'],
            enabled: true,
          })
        }
        // Never remove on toggle-off: retain as enabled:false so value survives
        return { ...prev, conditions }
      })
    },
    []
  )

  const setThreshold = useCallback(
    (type: AlertConditionType, ref: string | undefined, value: number) => {
      setDraft((prev) => {
        const conditions = [...prev.conditions]
        const idx = conditions.findIndex(
          (c) => c.type === type && (c.reference ?? '') === (ref ?? '')
        )
        if (idx >= 0) {
          // Update threshold only — do NOT change enabled
          conditions[idx] = { ...conditions[idx], threshold: value }
        } else {
          // Create with enabled:false so the value is stored without enabling
          conditions.push({
            type,
            threshold: value,
            reference: ref as ApiAlertCondition['reference'],
            enabled: false,
          })
        }
        return { ...prev, conditions }
      })
    },
    []
  )

  // Map (type, ref) to its index in draft.conditions (for error field lookup)
  const getCondIdx = useCallback(
    (type: AlertConditionType, ref?: string): number => {
      return draft.conditions.findIndex(
        (c) => c.type === type && (c.reference ?? '') === (ref ?? '')
      )
    },
    [draft.conditions]
  )

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const allConditionsDisabled = useMemo(
    () => draft.conditions.length > 0 && draft.conditions.every((c) => !c.enabled),
    [draft.conditions]
  )

  const reservedSymbols = useMemo(() => {
    const original = initial?.symbol?.toUpperCase()
    return existingSymbols.filter((s) => s.toUpperCase() !== original)
  }, [existingSymbols, initial])

  const symbolError = errors.find((e) => e.field === 'symbol')
  const conditionsError = errors.find((e) => e.field === 'conditions')

  // Enabled conditions only for live summary
  const enabledConditions = useMemo(
    () => draft.conditions.filter((c) => c.enabled),
    [draft.conditions]
  )

  // ---------------------------------------------------------------------------
  // Symbol handlers (unchanged from original)
  // ---------------------------------------------------------------------------

  const handleSymbolChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.toUpperCase()
    setSymbolQuery(next)
    setActiveSuggestion(-1)
    setDraft((prev) => ({ ...prev, symbol: next }))
  }, [])

  const handleSymbolPick = useCallback((symbol: string) => {
    setSymbolQuery(symbol)
    setDraft((prev) => ({ ...prev, symbol }))
    setSymbolFocus(false)
    setActiveSuggestion(-1)
  }, [])

  const handleSymbolKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!symbolFocus || suggestions.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSuggestion((i) => (i + 1) % suggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
      } else if (e.key === 'Enter') {
        if (activeSuggestion >= 0 && activeSuggestion < suggestions.length) {
          e.preventDefault()
          handleSymbolPick(suggestions[activeSuggestion])
        }
      } else if (e.key === 'Escape') {
        setSymbolFocus(false)
        setActiveSuggestion(-1)
      }
    },
    [symbolFocus, suggestions, activeSuggestion, handleSymbolPick]
  )

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(() => {
    const trimmed: ApiStockAlert = { ...draft, symbol: draft.symbol.trim().toUpperCase() }
    const found = validateAlert(trimmed, reservedSymbols)
    if (found.length > 0) {
      setErrors(found)
      return
    }
    onSave(trimmed)
  }, [draft, reservedSymbols, onSave])

  // canSubmit: symbol typed + at least one condition configured (enabled or paused)
  const canSubmit = draft.symbol.trim().length > 0

  const displaySymbol = draft.symbol.trim().toUpperCase() || 'THIS STOCK'

  // ---------------------------------------------------------------------------
  // Render helpers for prop drilling into fixed rows
  // ---------------------------------------------------------------------------

  // getCondIdx factory for ThresholdRow's condIdx prop
  const makeCondIdxGetter = useCallback(
    (type: AlertConditionType) => () => getCondIdx(type),
    [getCondIdx]
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="xl"
        className="flex flex-col gap-0 p-0 max-h-[90vh] overflow-hidden"
        overlayClassName="backdrop-blur-none"
        aria-describedby={undefined}
      >
        {/* Header */}
        <DialogHeader className="flex-row items-center gap-3 px-5 py-4 border-b border-[var(--border-dim)] space-y-0">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)] shrink-0 [&_svg]:w-4 [&_svg]:h-4">
            <Icons.Bell />
          </div>
          <DialogTitle className="flex-1 text-sm">
            {isEditing ? `Edit Alert — ${initial.symbol}` : 'Create Alert'}
          </DialogTitle>
        </DialogHeader>

        {/* Body: two-column on wider modal */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left: form */}
          <DialogBody className="flex-1 px-5 py-4 overflow-y-auto flex flex-col gap-5 min-w-0">

            {/* Symbol */}
            <div className="flex flex-col gap-1.5 relative">
              <label
                htmlFor="alert-symbol"
                className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest"
              >
                Symbol
              </label>
              <input
                id="alert-symbol"
                type="text"
                role="combobox"
                aria-expanded={symbolFocus && suggestions.length > 0}
                aria-controls="alert-symbol-listbox"
                aria-autocomplete="list"
                aria-activedescendant={
                  activeSuggestion >= 0 ? `alert-symbol-opt-${activeSuggestion}` : undefined
                }
                className={cn(
                  'px-3 py-2 bg-[var(--bg-deep)] border rounded text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--neon-cyan)] focus:ring-2 focus:ring-[var(--neon-cyan-dim)] transition-colors duration-150',
                  symbolError ? 'border-[var(--neon-bear)]' : 'border-[var(--border-dim)]'
                )}
                value={symbolQuery}
                onChange={handleSymbolChange}
                onKeyDown={handleSymbolKeyDown}
                onFocus={() => setSymbolFocus(true)}
                onBlur={() => setTimeout(() => setSymbolFocus(false), 120)}
                placeholder={symbolListLoading ? 'Loading symbols…' : 'Type ticker (e.g., FPT)'}
                disabled={isEditing}
                autoFocus={!isEditing}
              />
              {symbolFocus && suggestions.length > 0 && (
                <ul
                  id="alert-symbol-listbox"
                  className="absolute top-full left-0 right-0 mt-1 max-h-[180px] overflow-auto bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-10"
                  role="listbox"
                  aria-label="Symbol suggestions"
                >
                  {suggestions.map((s, i) => (
                    <li
                      key={s}
                      id={`alert-symbol-opt-${i}`}
                      role="option"
                      aria-selected={i === activeSuggestion}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSymbolPick(s)
                      }}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-mono cursor-pointer text-[var(--text-primary)] transition-colors duration-100',
                        i === activeSuggestion ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              {symbolError && (
                <span className="text-[11px] text-[var(--neon-bear)] flex items-center gap-1">
                  <Icons.Alert className="w-3 h-3 flex-shrink-0" />
                  {symbolError.message}
                </span>
              )}
            </div>

            {/* Conditions — grouped by category, full catalog always visible */}
            <div className="flex flex-col gap-4">
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
                Conditions
              </label>

              {CONDITION_CATEGORIES.map((cat) => {
                const catTypes = ALERT_CONDITION_TYPES.filter((opt) =>
                  cat.types.includes(opt.value)
                )
                const isMACategory = cat.id === 'ma_cross'

                return (
                  <div key={cat.id} className="flex flex-col gap-2">
                    {/* Category header */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-dim)]">
                        <CategoryIcon
                          name={cat.iconName}
                          className="w-3 h-3 text-[var(--neon-cyan)] flex-shrink-0"
                        />
                        <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                          {cat.label}
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-[var(--border-dim)]" aria-hidden="true" />
                    </div>

                    {/* Condition rows for this category */}
                    <div className="flex flex-col gap-1.5">
                      {isMACategory
                        ? // MA rows: one row per type (price_cross_above / price_cross_below)
                          catTypes.map((opt) => (
                            <MARow
                              key={opt.value}
                              type={opt.value}
                              isEnabled={isEnabled}
                              setEnabled={setEnabled}
                            />
                          ))
                        : catTypes.map((opt) =>
                            opt.hasThreshold ? (
                              <ThresholdRow
                                key={opt.value}
                                type={opt.value}
                                draft={draft}
                                errors={errors}
                                getCond={getCond}
                                isEnabled={isEnabled}
                                setEnabled={setEnabled}
                                setThreshold={setThreshold}
                                condIdx={makeCondIdxGetter(opt.value)}
                              />
                            ) : (
                              <SignalRow
                                key={opt.value}
                                type={opt.value}
                                isEnabled={isEnabled}
                                setEnabled={setEnabled}
                              />
                            )
                          )}
                    </div>
                  </div>
                )
              })}

              {conditionsError && (
                <span className="text-[11px] text-[var(--neon-bear)] flex items-center gap-1">
                  <Icons.Alert className="w-3 h-3 flex-shrink-0" />
                  {conditionsError.message}
                </span>
              )}

              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                <Icons.Info className="w-3 h-3 flex-shrink-0 shrink-0" />
                Each condition fires independently and auto-disables itself after firing.
              </p>
            </div>

            {/* Paused warning */}
            {allConditionsDisabled && (
              <div className="flex items-center gap-2 px-3 py-2 rounded border border-[rgba(255,170,0,0.3)] bg-[rgba(255,170,0,0.06)] text-[11px] text-[var(--neon-amber)]">
                <Icons.Alert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>All conditions disabled — alert will be paused</span>
              </div>
            )}
          </DialogBody>

          {/* Right: live summary panel */}
          <aside className="lg:w-[220px] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-dim)] bg-[var(--bg-deep)] flex flex-col gap-3 px-4 py-4 overflow-y-auto">
            <div className="flex items-center gap-1.5">
              <Icons.List className="w-3.5 h-3.5 text-[var(--neon-cyan)] shrink-0" />
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
                Live Summary
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Alert me when{' '}
                <span className="font-mono font-semibold text-[var(--neon-cyan)]">
                  {displaySymbol}
                </span>
                :
              </p>

              {enabledConditions.length === 0 ? (
                <p className="text-[11px] text-[var(--text-muted)] italic mt-1">
                  No conditions enabled yet.
                </p>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {/* Enabled conditions grouped under their category header */}
                  {CONDITION_CATEGORIES.filter((cat) =>
                    enabledConditions.some((c) => cat.types.includes(c.type))
                  ).map((cat) => {
                    const Icon = Icons[cat.iconName as keyof typeof Icons]
                    const conds = enabledConditions.filter((c) => cat.types.includes(c.type))
                    return (
                      <div key={cat.id} className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                          {Icon && <Icon className="w-3 h-3 text-[var(--neon-cyan)]" />}
                          {cat.label}
                        </span>
                        <ul className="flex flex-col gap-1 pl-1" role="list">
                          {conds.map((cond) => {
                            const sentiment = getConditionSentiment(cond.type)
                            return (
                              <li
                                key={`${cond.type}:${cond.reference ?? ''}`}
                                className={cn(
                                  'flex items-start gap-1.5 text-[11px] leading-relaxed',
                                  SENTIMENT_TEXT[sentiment]
                                )}
                              >
                                <span
                                  className={cn(
                                    'mt-1.5 w-1.5 h-1.5 rounded-full shrink-0',
                                    SENTIMENT_DOT[sentiment]
                                  )}
                                  aria-hidden="true"
                                />
                                {describeCondition(cond, draft.symbol)}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 mt-0 gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSubmit}>
            {isEditing ? 'Update' : 'Create'} Alert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
