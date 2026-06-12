import { ApiTrendlineDisplay, ApiTrendlineDataPoint, ApiPriceData } from './api'

/**
 * Extends every trendline forward to the current price by ONE uniform convention
 * (no per-signal, per-type special-casing):
 *
 *  - Project the line forward from its end pivot along its own slope, one point per
 *    bar: price = intercept + index*slope, where intercept = end_price - endBar.index*slope.
 *  - STOP at the first bar whose CLOSE crosses the line — resistance (downtrend_resistance):
 *    close > linePrice (breakout); support (uptrend_support): close < linePrice (breakdown).
 *    This matches the backend's crossing definition (signal_generator.go
 *    findCrossingPointAbove/Below), so a line that has already been broken stops exactly
 *    at its break and is never drawn past it.
 *  - If price never closes across the line, the projection reaches the latest bar, so a
 *    still-valid ("potential") line extends all the way to the current price.
 *
 * The crossing is computed geometrically from priceHistory, NOT from analyze signals:
 * backend signals carry no trendline identity, so pairing a line to a signal by type+date
 * mis-associates an unrelated breakout (drawing the line to the wrong bar). Geometry is
 * per-line and exact.
 *
 * Precondition: `priceHistory` is in ascending date order (as the analyze API returns it).
 * Order matters — the projection stops at the FIRST close-cross, so a shuffled history
 * would truncate at the wrong bar.
 */
export function extendTrendlinesToCurrentPrice(
  trendlines: ApiTrendlineDisplay[],
  priceHistory: ApiPriceData[]
): ApiTrendlineDisplay[] {
  if (!priceHistory.length) return trendlines
  return trendlines.map((trendline) => extendTrendline(trendline, priceHistory))
}

function extendTrendline(
  trendline: ApiTrendlineDisplay,
  priceHistory: ApiPriceData[]
): ApiTrendlineDisplay {
  const endBar = priceHistory.find((bar) => bar.date === trendline.end_date)
  if (!endBar) return trendline

  const intercept = trendline.end_price - endBar.index * trendline.slope
  const isSupport = trendline.type === 'uptrend_support'

  // priceHistory is chronological (ascending), so the first close-cross we reach is the
  // earliest break — include that bar and stop, leaving the line truncated there.
  const points: ApiTrendlineDataPoint[] = []
  for (const bar of priceHistory) {
    if (bar.date <= trendline.end_date) continue

    const linePrice = intercept + bar.index * trendline.slope
    points.push({ date: bar.date, price: linePrice })

    const crossed = isSupport ? bar.close < linePrice : bar.close > linePrice
    if (crossed) break
  }

  if (!points.length) return trendline

  const lastPoint = points[points.length - 1]
  return {
    ...trendline,
    data_points: [...trendline.data_points, ...points],
    end_date: lastPoint.date,
    end_price: lastPoint.price,
  }
}
