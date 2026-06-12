import type { ApiDivergence, ApiPriceData } from './api'

export interface RsiPoint {
  time: string
  value: number
}

// Chart colors (match the price-side trendline / candle palette in PriceChart)
const BULL_COLOR = '#10b981'
const BEAR_COLOR = '#ef4444'

export interface RsiMarker {
  time: string
  position: 'aboveBar' | 'belowBar'
  color: string
  shape: 'arrowUp' | 'arrowDown' | 'circle'
  text?: string
}

export interface RsiDivergenceLine {
  type: 'bullish' | 'bearish'
  color: string
  points: RsiPoint[] // ascending by time
}

// date -> RSI value, excluding warm-up (rsi === 0) and missing bars
function rsiByDate(priceHistory: ApiPriceData[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of priceHistory) {
    if (p.rsi != null && p.rsi !== 0) m.set(p.date, p.rsi)
  }
  return m
}

const byTimeAsc = (a: { time: string }, b: { time: string }) =>
  a.time < b.time ? -1 : a.time > b.time ? 1 : 0

/**
 * Markers placed ON the RSI line at each divergence pivot. A pivot whose date
 * landed on a dropped warm-up bar (rsi === 0) is skipped. The later pivot of
 * each divergence gets the directional arrow + label; earlier pivots get a dot.
 * Returned ascending by time (lightweight-charts requires sorted markers).
 */
export function buildRsiMarkers(
  divergences: ApiDivergence[],
  priceHistory: ApiPriceData[]
): RsiMarker[] {
  const byDate = rsiByDate(priceHistory)
  const markers: RsiMarker[] = []
  for (const d of divergences) {
    const isBull = d.type === 'bullish'
    const pts = d.divergence_points.filter((pt) => byDate.has(pt.date))
    pts.forEach((pt, i) => {
      const isLast = i === pts.length - 1
      markers.push({
        time: pt.date,
        position: isBull ? 'belowBar' : 'aboveBar',
        color: isBull ? BULL_COLOR : BEAR_COLOR,
        shape: isLast ? (isBull ? 'arrowUp' : 'arrowDown') : 'circle',
        text: isLast ? (isBull ? 'Bull' : 'Bear') : undefined,
      })
    })
  }
  return markers.sort(byTimeAsc)
}

/**
 * One sloped connector line per divergence, joining the RSI value at each
 * divergence pivot date — the RSI-side mirror of the price trendline. Pivots on
 * dropped warm-up bars are skipped; a divergence with fewer than 2 plottable
 * pivots produces no connector.
 */
export function buildRsiDivergenceLines(
  divergences: ApiDivergence[],
  priceHistory: ApiPriceData[]
): RsiDivergenceLine[] {
  const byDate = rsiByDate(priceHistory)
  const lines: RsiDivergenceLine[] = []
  for (const d of divergences) {
    const points: RsiPoint[] = []
    for (const pt of d.divergence_points) {
      const value = byDate.get(pt.date)
      if (value === undefined) continue
      points.push({ time: pt.date, value })
    }
    points.sort(byTimeAsc)
    if (points.length < 2) continue
    lines.push({
      type: d.type,
      color: d.type === 'bullish' ? BULL_COLOR : BEAR_COLOR,
      points,
    })
  }
  return lines
}

/**
 * Build the RSI line series from analyze price history.
 *
 * The backend emits per-bar RSI at `price_history[].rsi`, but the first
 * `rsi_period` bars are warm-up and carry `rsi === 0` (the domain uses
 * `HasRSI := rsi !== 0`). Those bars — and any missing `rsi` — are EXCLUDED
 * so the line doesn't dive to 0 at the series start. Output is sorted
 * ascending by date (lightweight-charts requires ascending time).
 */
export function buildRsiData(priceHistory: ApiPriceData[]): RsiPoint[] {
  const out: RsiPoint[] = []
  for (const p of priceHistory) {
    if (p.rsi == null || p.rsi === 0) continue
    out.push({ time: p.date, value: p.rsi })
  }
  out.sort(byTimeAsc)
  return out
}
