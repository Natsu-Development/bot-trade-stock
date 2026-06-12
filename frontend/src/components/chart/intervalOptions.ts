export interface IntervalOption {
  value: string
  label: string
}

/** Controlled props for the chart interval (timeframe) selector. */
export interface IntervalControl {
  value: string
  options: IntervalOption[]
  onChange: (value: string) => void
}

/**
 * Chart interval (timeframe) options — the day-granular set the chart can actually
 * render. Single source for both the Analyze and Screener charts.
 *
 * WHY ONLY 1D/1W/1M: the backend (market.NewInterval, interval.go) also validates and
 * fetches six INTRADAY intervals — 1m, 5m, 15m, 30m, 1H, 4H — but the analyze DTO emits
 * date-only bars (MarketDataDTO.Date = time.Format("2006-01-02"), common.go), so every
 * intraday bar on a day collapses to the same calendar date. lightweight-charts keys its
 * series by `time` and rejects the duplicates ("data must be asc ordered by time"),
 * blanking the chart. Exposing intraday therefore requires the backend to emit a real
 * per-bar timestamp (unix seconds) AND the frontend to map series `time` to it — a
 * separate backend+frontend change, not just a dropdown option.
 */
export const CHART_INTERVAL_OPTIONS: IntervalOption[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
]
