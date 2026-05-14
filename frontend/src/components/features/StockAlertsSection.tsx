import { memo, useCallback, useMemo, useState } from 'react'
import { Icons } from '../icons/Icons'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StockAlertRow } from './StockAlertRow'
import { StockAlertEditorModal } from './StockAlertEditorModal'
import { alertsEqual } from '@/lib/alertOptions'
import type { ApiStockAlert } from '@/lib/api'

interface StockAlertsSectionProps {
  alerts: ApiStockAlert[]
  originalAlerts: ApiStockAlert[]
  onUpdate: (alerts: ApiStockAlert[]) => void
}

export const StockAlertsSection = memo(function StockAlertsSection({
  alerts,
  originalAlerts,
  onUpdate,
}: StockAlertsSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

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
            <Button variant="secondary" icon="Plus" onClick={handleAdd}>
              <span>Add Alert</span>
            </Button>
          </div>

          <p className="text-sm text-[var(--text-muted)] mb-4">
            Get notified on Telegram when price or volume crosses your thresholds.
            {alerts.length > 0 && (
              <span
                className={`ml-2 font-mono text-xs ${
                  conditionTotals.active === 0 ? 'text-[var(--text-muted)]' : ''
                }`}
              >
                {alerts.length} alert{alerts.length === 1 ? '' : 's'} ·{' '}
                {conditionTotals.active}/{conditionTotals.total} conditions active
              </span>
            )}
          </p>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-[var(--border-dim)] rounded-lg">
              <Icons.Bell className="w-10 h-10 mb-3 opacity-40 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)] mb-1">No alerts configured</p>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Add price or volume triggers for your watched symbols
              </p>
              <Button variant="secondary" icon="Plus" onClick={handleAdd}>
                <span>Add your first alert</span>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {alerts.map((alert, idx) => (
                <StockAlertRow
                  key={`${alert.symbol}-${idx}`}
                  alert={alert}
                  index={idx}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

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
