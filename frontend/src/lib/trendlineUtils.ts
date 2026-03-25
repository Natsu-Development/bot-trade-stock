import { ApiTrendlineDisplay, ApiAnalysisSignal, ApiTrendlineDataPoint, ApiPriceData } from './api'

/**
 * Extends trendlines to crossover points by calculating intermediate points
 * along the trendline's slope (not just drawing a straight line to crossover).
 *
 * Formula: price = intercept + index × slope
 * Where: intercept = end_price - end_index × slope
 */
export function extendTrendlinesToCrossover(
  trendlines: ApiTrendlineDisplay[],
  signals: ApiAnalysisSignal[],
  priceHistory: ApiPriceData[]
): ApiTrendlineDisplay[] {
  if (!priceHistory.length) return trendlines

  return trendlines.map(trendline => {
    const matchedSignal = findMatchingSignal(trendline, signals)
    if (!matchedSignal || matchedSignal.price_line === undefined) {
      return trendline
    }

    const crossoverDate = matchedSignal.time
    const endDate = trendline.end_date

    // Signal must be AFTER trendline end date
    if (crossoverDate <= endDate) {
      return trendline
    }

    const extendedPoints = calculateExtensionPoints(
      trendline,
      crossoverDate,
      priceHistory
    )

    if (!extendedPoints.length) return trendline

    const lastPoint = extendedPoints[extendedPoints.length - 1]
    return {
      ...trendline,
      data_points: [...trendline.data_points, ...extendedPoints],
      end_date: lastPoint.date,
      end_price: lastPoint.price,
    }
  })
}

/**
 * Calculates intermediate points from trendline end to crossover date
 * using the trendline's slope to ensure correct angle.
 */
function calculateExtensionPoints(
  trendline: ApiTrendlineDisplay,
  crossoverDate: string,
  priceHistory: ApiPriceData[]
): ApiTrendlineDataPoint[] {
  // Find the bar matching trendline's end_date to get end_index
  const endBar = priceHistory.find(bar => bar.date === trendline.end_date)
  if (!endBar) return []

  // Calculate intercept: intercept = end_price - end_index × slope
  const intercept = trendline.end_price - endBar.index * trendline.slope

  // Generate points for each trading day from end_date to crossover_date
  const points: ApiTrendlineDataPoint[] = []

  for (const bar of priceHistory) {
    if (bar.date > trendline.end_date && bar.date <= crossoverDate) {
      // Calculate price using trendline formula: price = intercept + index × slope
      const price = intercept + bar.index * trendline.slope
      points.push({ date: bar.date, price })
    }
  }

  return points
}

function findMatchingSignal(
  trendline: ApiTrendlineDisplay,
  signals: ApiAnalysisSignal[]
): ApiAnalysisSignal | null {
  for (const signal of signals) {
    if (signal.price_line === undefined) continue

    const signalDate = signal.time
    const endDate = trendline.end_date

    // Signal must be AFTER trendline end date
    if (signalDate <= endDate) continue

    // Match by trendline type
    const isSupportSignal = trendline.type === 'uptrend_support' &&
      (signal.type === 'bounce_confirmed' || signal.type.includes('break'))
    const isResistanceSignal = trendline.type === 'downtrend_resistance' &&
      signal.type === 'breakout_confirmed'

    if (isSupportSignal || isResistanceSignal) {
      return signal
    }
  }

  return null
}