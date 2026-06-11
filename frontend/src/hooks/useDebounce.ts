import { useEffect, useRef, useState } from 'react'

/**
 * Debounce delay (ms) for the symbol that FEEDS the chart analyze-fetch on the
 * Screener master–detail split. Shared by the impl AND the Playwright e2e so
 * debounce-settle waits track the constant. Keep highlight + header instant; only
 * the network fetch is debounced (M2/R1).
 */
export const SYMBOL_DEBOUNCE_MS = 200

/**
 * Returns a debounced copy of `value` that only updates after `ms` of quiet.
 *
 * The initial value is passed straight through (NO initial delay) so the
 * default/first selection is INSTANT — only subsequent (inter-row navigation)
 * changes are debounced. NOT `useDeferredValue` (which defers render priority,
 * not network timing, and would not throttle per-row analyze floods).
 */
export function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  // Skip debouncing the very first value so the default selection is instant.
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      setDebounced(value)
      return
    }
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])

  return debounced
}
