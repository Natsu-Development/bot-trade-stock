import { memo, useCallback, useMemo, useState } from 'react'
import { Icons } from '../icons/Icons'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StockAlertRow } from './StockAlertRow'
import { StockAlertConditionDetail } from './StockAlertConditionDetail'
import { StockAlertEditorModal } from './StockAlertEditorModal'
import { alertsEqual } from '@/lib/alertOptions'
import type { ApiStockAlert } from '@/lib/api'

interface StockAlertsSectionProps {
  alerts: ApiStockAlert[]
  originalAlerts: ApiStockAlert[]
  onUpdate: (alerts: ApiStockAlert[]) => void
}

const detailPanelId = (symbol: string) => `alert-detail-${symbol}`

export const StockAlertsSection = memo(function StockAlertsSection({
  alerts,
  originalAlerts,
  onUpdate,
}: StockAlertsSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  // Expand-state is component-local ONLY and is never lifted into the alerts
  // array, so toggling it cannot trip `isDirty` (alertsEqual is unaffected).
  const [expandSet, setExpandSet] = useState<Set<string>>(() => new Set())

  const isDirty = useMemo(() => !alertsEqual(alerts, originalAlerts), [alerts, originalAlerts])

  const conditionTotals = useMemo(() => {
    let active = 0
    let total = 0
    for (const a of alerts) {
      for (const c of a.conditions) {
        total += 1
        if (c.enabled) active += 1
      }
    }
    return { active, total }
  }, [alerts])

  const existingSymbols = useMemo(() => alerts.map((a) => a.symbol), [alerts])

  // Reconcile-from-props (M4): effectively-expanded = expandSet ∩ live symbols.
  // The incoming `alerts` prop is the single source of truth for which symbols
  // exist; a stale key (deleted or renamed symbol) is simply never rendered, so
  // delete AND rename self-heal without pruning inside an onUpdate handler.
  const effectivelyExpanded = useMemo(() => {
    const live = new Set<string>()
    for (const a of alerts) {
      if (expandSet.has(a.symbol)) live.add(a.symbol)
    }
    return live
  }, [expandSet, alerts])

  const allExpanded = alerts.length > 0 && effectivelyExpanded.size === alerts.length

  const handleAdd = useCallback(() => {
    setEditingIndex(null)
    setEditorOpen(true)
  }, [])

  const handleEdit = useCallback((index: number) => {
    setEditingIndex(index)
    setEditorOpen(true)
  }, [])

  const handleDelete = useCallback(
    (index: number) => {
      const symbol = alerts[index]?.symbol
      if (!window.confirm(`Delete alert for ${symbol}?`)) return
      onUpdate(alerts.filter((_, i) => i !== index))
    },
    [alerts, onUpdate]
  )

  const handleToggle = useCallback((symbol: string) => {
    setExpandSet((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    setExpandSet(new Set(alerts.map((a) => a.symbol)))
  }, [alerts])

  const handleCollapseAll = useCallback(() => {
    setExpandSet(new Set())
  }, [])

  const handleSaveDraft = useCallback(
    (draft: ApiStockAlert) => {
      if (editingIndex === null) {
        onUpdate([...alerts, draft])
      } else {
        onUpdate(alerts.map((a, i) => (i === editingIndex ? draft : a)))
      }
      setEditorOpen(false)
      setEditingIndex(null)
    },
    [editingIndex, alerts, onUpdate]
  )

  const handleClose = useCallback(() => {
    setEditorOpen(false)
    setEditingIndex(null)
  }, [])

  const initialDraft = editingIndex !== null ? alerts[editingIndex] ?? null : null

  return (
    <Card className="mb-6">
      <Card.Body>
        <div className="config-section !mb-0">
          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="config-section-title !mb-0 flex items-center gap-2">
              <Icons.Bell />
              <span>Stock Alerts</span>
              {isDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-[var(--neon-cyan)] shadow-[0_0_8px_var(--neon-cyan)]"
                  title="Unsaved changes"
                  aria-label="Unsaved changes"
                />
              )}
            </h3>
            <Button variant="secondary" size="sm" icon="Plus" onClick={handleAdd}>
              <span>Add Alert</span>
            </Button>
          </div>

          {/* Subtitle + stats */}
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Get notified on Telegram when price or volume crosses your thresholds.
            {alerts.length > 0 && (
              <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">
                {alerts.length} alert{alerts.length === 1 ? '' : 's'} &middot;{' '}
                <span
                  className={
                    conditionTotals.active === 0
                      ? 'text-[var(--neon-amber)]'
                      : 'text-[var(--neon-cyan)]'
                  }
                >
                  {conditionTotals.active}/{conditionTotals.total} conditions active
                </span>
              </span>
            )}
          </p>

          {/* Alert list or empty state */}
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-[var(--border-dim)] rounded-lg gap-3">
              <Icons.Bell className="w-10 h-10 opacity-30 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm text-[var(--text-muted)] mb-0.5">No alerts configured</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Add price or volume triggers for your watched symbols
                </p>
              </div>
              <Button variant="secondary" size="sm" icon="Plus" onClick={handleAdd}>
                <span>Add your first alert</span>
              </Button>
            </div>
          ) : (
            <>
              {/* Expand-all / Collapse-all controls (hidden on empty state) */}
              <div className="flex items-center justify-end gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpandAll}
                  disabled={allExpanded}
                >
                  <span>Expand all</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCollapseAll}
                  disabled={effectivelyExpanded.size === 0}
                >
                  <span>Collapse all</span>
                </Button>
              </div>

              {/* Column header — aligned to the row tracks */}
              <div className="alert-row-grid px-3 py-1.5 text-[11px] uppercase tracking-wider text-left font-medium text-[var(--text-muted)]">
                <span>Symbol</span>
                <span>Status</span>
                <span>Watching</span>
                <span>On/Total</span>
                <span aria-hidden="true" />
                <span className="justify-self-end">Actions</span>
              </div>

              <div className="flex flex-col gap-2">
                {alerts.map((alert, idx) => {
                  const expanded = effectivelyExpanded.has(alert.symbol)
                  const panelId = detailPanelId(alert.symbol)
                  return (
                    <div
                      key={`${alert.symbol}-${idx}`}
                      className="rounded-md border border-[var(--border-dim)] overflow-hidden bg-[var(--bg-surface)] transition-colors duration-150 hover:border-[var(--border-glow)]"
                    >
                      <StockAlertRow
                        alert={alert}
                        index={idx}
                        expanded={expanded}
                        panelId={panelId}
                        onToggle={handleToggle}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                      {expanded && (
                        <StockAlertConditionDetail
                          alert={alert}
                          index={idx}
                          panelId={panelId}
                          onEdit={handleEdit}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Editor modal — rendered via Radix Dialog portal */}
        {editorOpen && (
          <StockAlertEditorModal
            initial={initialDraft}
            existingSymbols={existingSymbols}
            onSave={handleSaveDraft}
            onClose={handleClose}
          />
        )}
      </Card.Body>
    </Card>
  )
})
