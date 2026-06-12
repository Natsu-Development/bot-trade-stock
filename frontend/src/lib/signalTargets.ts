/**
 * Derives the Target and Stop prices shown for a trendline (breakout/breakdown)
 * signal in the Analyze Signals table.
 *
 * The backend never sets target/stop on a signal — it only provides `price_line`,
 * the trendline's projected price at the latest bar ("the potential value of this
 * trendline"). So we derive both here from data the signal already carries:
 *
 *  - target = price_line — the trendline level the price is heading toward
 *    (above entry for a potential breakout, below entry for a potential breakdown).
 *  - stop   = 2*price - price_line — the target mirrored around the entry price
 *    (a 1:1 risk:reward invalidation level on the opposite side of entry).
 *    Directionally correct for both directions and needs no magic constant.
 *
 * Only POTENTIAL signals get a target/stop: a *_confirmed breakout/breakdown has
 * already crossed its line, so `price_line` is a far extrapolation of the (now
 * broken) trendline, not a usable target — those rows stay em-dash.
 *
 * Returns undefined fields when there is no usable trendline level, so the table
 * renders an em-dash for those rows.
 */
export interface SignalTargets {
  target?: number
  stop?: number
}

export function deriveSignalTargets(signal: {
  type: string
  price: number
  price_line?: number
}): SignalTargets {
  const { type, price, price_line } = signal

  if (!type.endsWith('_potential')) {
    return {}
  }

  if (!isPositiveFinite(price) || !isPositiveFinite(price_line)) {
    return {}
  }

  const target = price_line
  const stop = 2 * price - price_line

  return { target, stop: isPositiveFinite(stop) ? stop : undefined }
}

function isPositiveFinite(value: number | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0
}
