import { memo, useMemo } from 'react'
import type { ApiStockAlert } from '@/lib/api'
import { countEnabledByCategory } from '@/lib/alertOptions'
import { CATEGORY_SHORT_CODE } from '@/lib/alertStyles'

interface StockAlertCategoryChipsProps {
  alert: ApiStockAlert
}

/**
 * Maximum number of per-category chips that fit the WATCHING cell at minimum
 * layout width. There are exactly 5 categories; capping at 4 means only the
 * all-5-categories case collapses to the `Σ n on` summary. Chosen to fit the
 * fixed-width cell, not as a magic number.
 */
const MAX_CHIPS = 4

const CHIP_CLASS =
  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--border-dim)] bg-[var(--bg-deep)] text-[10px] font-mono text-[var(--text-secondary)] whitespace-nowrap shrink-0'

/**
 * Neutral (no sentiment hue) WATCHING summary for the collapsed row. Renders one
 * count chip per category with enabled conditions (`PRICE 2 · VOL 1 · …`). When
 * there would be more than MAX_CHIPS categories, collapses to a single `Σ n on`
 * summary chip where n = total enabled conditions (may be 0 → `Σ 0 on`). The
 * container never wraps (`flex-nowrap` + `overflow-hidden`).
 */
export const StockAlertCategoryChips = memo(function StockAlertCategoryChips({
  alert,
}: StockAlertCategoryChipsProps) {
  const counts = useMemo(() => countEnabledByCategory(alert), [alert])
  const totalEnabled = useMemo(
    () => counts.reduce((n, c) => n + c.count, 0),
    [counts]
  )

  const summarize = counts.length > MAX_CHIPS

  return (
    <div className="flex items-center gap-1 flex-nowrap overflow-hidden min-w-0">
      {summarize ? (
        <span className={CHIP_CLASS}>{`Σ ${totalEnabled} on`}</span>
      ) : counts.length === 0 ? (
        <span className={CHIP_CLASS}>Σ 0 on</span>
      ) : (
        counts.map((c) => (
          <span key={c.id} className={CHIP_CLASS}>
            {CATEGORY_SHORT_CODE[c.id]} {c.count}
          </span>
        ))
      )}
    </div>
  )
})
