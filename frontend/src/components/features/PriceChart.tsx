import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  BaselineSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type CandlestickData,
  type LineData,
  type BaselineData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'
import { cn } from '@/lib/utils'
import {
  isSignalConfirmed,
  type ApiPriceData,
  type ApiDivergence,
  ApiTrendlineDisplay,
  ApiTradingSignal,
} from '@/lib/api'
import { buildRsiMarkers, buildRsiDivergenceLines } from '@/lib/rsiSeries'
import { extendTrendlinesToCurrentPrice } from '@/lib/trendlineUtils'
import { useChartConfig } from '@/hooks/chart/useChartConfig'
import { useChartControls } from '@/hooks/chart/useChartControls'
import { ChartControls } from '@/components/chart/ChartControls'
import type { IntervalControl } from '@/components/chart/IntervalSwitch'
import { ChartLegend } from '@/components/chart/ChartLegend'
import { CrosshairOverlay, type CrosshairOverlayRef } from '@/components/chart/CrosshairOverlay'
import type { ChartTime, ChartCandlestickData, ChartLineData } from '@/types/chart'

interface PriceChartProps {
  symbol: string
  priceHistory: ApiPriceData[]
  trendlines?: ApiTrendlineDisplay[]
  signals?: ApiTradingSignal[]
  rsiData?: Array<{ time: string; value: number }>
  /** Divergences (bullish/bearish) used to decorate the RSI sub-pane with 70/30
   *  guide lines, per-pivot markers, and a sloped connector line per divergence.
   *  Only applied when rsiData is non-empty, so the screener (no rsiData) is unaffected. */
  divergences?: ApiDivergence[]
  className?: string
  /** Show the scroll & scale (navigation + zoom) controls. Default true; the
   *  screener passes false and uses an interval switch instead. */
  showNavZoom?: boolean
  /** Optional interval (timeframe) switch rendered in the chart control row,
   *  beside the overlay toggles. The screener passes it; Divergence omits it. */
  intervalControl?: IntervalControl
  /** Start with the RSI sub-pane shown (Analyze passes true; screener omits → off). */
  initialShowRsi?: boolean
  /** Initial price-area height in px (Analyze passes a larger value; default 400). */
  initialHeight?: number
  /** Notified when the user toggles RSI — lets a parent persist the choice across
   *  remounts (the screener unmounts the chart while loading each new symbol). */
  onShowRsiChange?: (show: boolean) => void
  /**
   * Fill the parent's height instead of a fixed pixel height (screener). The chart
   * container is measured (ResizeObserver) and the canvas spans the whole pane below
   * the toolbar/legend, so RSI-off leaves no empty gap and RSI-on shares the full
   * height. Analyze omits this → keeps its fixed initialHeight. */
  fillHeight?: boolean
}

// Convert API price data to chart candlestick data
function convertToCandlestickData(price: ApiPriceData): ChartCandlestickData {
  return {
    time: price.date as ChartTime,
    open: price.open,
    high: price.high,
    low: price.low,
    close: price.close,
  }
}

// RSI line stays the TradingView RSI purple (#7E57C2) at all times — like Pine, the
// out-of-band signal lives in the FILL, never the line color: green fills ONLY the
// gap between the 70 boundary and the line when overbought (RSI > 70), red fills ONLY
// the gap between the 30 boundary and the line when oversold (RSI < 30). The 30–70
// mid-band carries no green/red.
const RSI_PURPLE = '#7E57C2'
// Purple shading the 30-70 zone (Pine "RSI Background Fill" #7E57C2). Opacity kept high
// enough that the zone reads as a clearly-filled band across the whole pane — including
// the warm-up region where the RSI line is absent.
const RSI_BAND_COLOR = 'rgba(126, 87, 194, 0.2)'

// Lock the RSI pane's native right axis (pane 1) to a fixed 0–100 range (TradingView-
// faithful) so the boundary-anchored gradient fills land exactly at 100/70/30/0,
// mirroring Pine's `fill(rsi, mid, 100, 70, …)` / `fill(rsi, mid, 30, 0, …)`. Applied
// to every series in pane 1 (the three baseline fills + the divergence connectors) so
// the axis never floats with the data range.
const rsiAutoscaleTo100 = () => ({ priceRange: { minValue: 0, maxValue: 100 } })

// Convert API RSI data to baseline data. The line color comes uniformly from the
// series options (RSI_PURPLE); no per-point override, so the line never changes
// color — out-of-band is conveyed by the green/red baseline fill instead.
function convertToRsiBaselineData(rsi: { time: string; value: number }): BaselineData {
  return {
    time: rsi.time as ChartTime,
    value: rsi.value,
  }
}

// Convert trendline point to chart line data
function convertTrendlinePoint(point: { date: string; price: number }): ChartLineData {
  return {
    time: point.date as ChartTime,
    value: point.price,
  }
}

function PriceChartComponent({
  symbol,
  priceHistory,
  trendlines: propTrendlines,
  signals: propSignals,
  rsiData: propRsiData,
  divergences: propDivergences,
  className,
  showNavZoom = true,
  intervalControl,
  initialShowRsi = false,
  initialHeight = 400,
  onShowRsiChange,
  fillHeight = false,
}: PriceChartProps) {
  // Use stable empty arrays for default props to prevent infinite loops
  const stableTrendlines = useMemo(() => propTrendlines ?? [], [propTrendlines])
  const stableSignals = useMemo(() => propSignals ?? [], [propSignals])
  const stableRsiData = useMemo(() => propRsiData ?? [], [propRsiData])
  const stableDivergences = useMemo(() => propDivergences ?? [], [propDivergences])

  // Project each trendline forward to the current price, stopping where price crosses it.
  // Uniform geometric rule (see trendlineUtils) — no signal matching.
  const extendedTrendlines = useMemo(() => {
    return extendTrendlinesToCurrentPrice(stableTrendlines, priceHistory)
  }, [stableTrendlines, priceHistory])

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const trendlineSeriesRef = useRef<ISeriesApi<'Line'>[]>([])
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<'Baseline'> | null>(null)
  // Faint purple band that shades the 30-70 RSI zone (Pine "RSI Background Fill").
  const rsiBandSeriesRef = useRef<ISeriesApi<'Baseline'> | null>(null)
  // Oversold red fill (baseline anchored at 30); see the init effect for details.
  const rsiOversoldSeriesRef = useRef<ISeriesApi<'Baseline'> | null>(null)
  const rsiDivergenceSeriesRef = useRef<ISeriesApi<'Line'>[]>([])
  const rsiPriceLinesRef = useRef<IPriceLine[]>([])
  // v5 markers plugin: setMarkers() was removed from ISeriesApi, so markers are now
  // driven through a per-series plugin created ONCE in the init effect and reused.
  const candleMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const rsiMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const crosshairOverlayRef = useRef<CrosshairOverlayRef>(null)

  const [chartHeight, setChartHeight] = useState(initialHeight)
  const [showTrendlines, setShowTrendlines] = useState(true)
  const [showSignals, setShowSignals] = useState(true)
  const showVolume = true // Always show volume
  const [showRsi, setShowRsi] = useState(initialShowRsi)
  // Bottom share of the drawing area given to the native RSI pane (pane 1); the
  // draggable divider tunes it and the data effect maps it to panes()[1].setHeight().
  const [rsiFraction, setRsiFraction] = useState(0.28)
  // Height of the chart's bottom time-axis row (≈28px). The RSI pane height is a
  // fraction (rsiFraction) of the DRAWING area = canvas − this axis, so the divider +
  // drag must be measured against the drawing area, not the full canvas.
  // Starts 0 (→ paneHeight falls back to the full canvas) and is corrected to the real
  // axis height right after the first data load; the RSI divider is off by default so
  // the one-frame fallback isn't visible on a normal load.
  const [timeAxisHeight, setTimeAxisHeight] = useState(0)
  // Fill mode: the measured height of the chart container (its flex-allotted height,
  // NOT the canvas). Drives totalHeight so the canvas spans the whole pane. 0 until the
  // ResizeObserver below reports the first layout → totalHeight falls back to the fixed
  // formula for that one frame (hidden by the loading state).
  const [measuredHeight, setMeasuredHeight] = useState(0)

  // Chart configuration hook
  const { totalHeight, volumeScaleMargins, priceScaleMargins, rsiScaleMargins, chartOptions } =
    useChartConfig(
      chartContainerRef.current?.clientWidth ?? 0,
      chartHeight,
      showVolume,
      showRsi,
      fillHeight ? measuredHeight : 0
    )

  // The series drawing area (where scaleMargins fractions apply): canvas minus the time axis.
  const paneHeight = Math.max(1, totalHeight - timeAxisHeight)

  // Chart controls hook
  const {
    zoomPercentage,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    resetZoom,
    goToStart,
    goToEnd,
    scrollLeft,
    scrollRight,
  } = useChartControls(chartRef)

  // Cleanup trendline series
  const cleanupTrendlineSeries = useCallback(() => {
    if (chartRef.current && trendlineSeriesRef.current.length > 0) {
      trendlineSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series)
        } catch {
          // Series already removed
        }
      })
      trendlineSeriesRef.current = []
    }
  }, [])

  // Cleanup RSI divergence connector series + 70/30 price lines (mirrors the
  // trendline cleanup). Safe to call when the chart/series were already removed.
  const cleanupRsiDecorations = useCallback(() => {
    if (chartRef.current) {
      rsiDivergenceSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series)
        } catch {
          // Series already removed
        }
      })
    }
    rsiDivergenceSeriesRef.current = []
    rsiPriceLinesRef.current.forEach((line) => {
      try {
        rsiSeriesRef.current?.removePriceLine(line)
      } catch {
        // Series already replaced
      }
    })
    rsiPriceLinesRef.current = []
  }, [])

  // Fill mode: track the chart container's flex-allotted height so totalHeight (and
  // therefore the canvas) spans the whole pane. The container is `h-full` inside a
  // `flex-1 min-h-0 overflow-hidden` wrapper, so its height is set by the surrounding
  // flex column — NOT by the canvas it holds — which keeps this free of a
  // measure→size→measure feedback loop. useLayoutEffect measures synchronously before
  // paint so the chart is created at the right height (no resize flash). Width is left
  // to the existing resize handler.
  useLayoutEffect(() => {
    if (!fillHeight) return
    const el = chartContainerRef.current
    if (!el) return
    const measure = () => {
      const h = el.getBoundingClientRect().height
      if (h > 0) setMeasuredHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fillHeight])

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current
    const width = container.clientWidth

    // Create chart with configured options
    const chart = createChart(container, {
      ...chartOptions,
      width,
      height: totalHeight,
      crosshair: {
        ...chartOptions.crosshair,
        vertLine: {
          ...chartOptions.crosshair.vertLine,
          width: 1 as any, // Type workaround for lightweight-charts
        },
        horzLine: {
          ...chartOptions.crosshair.horzLine,
          width: 1 as any, // Type workaround for lightweight-charts
        },
      },
    })

    chartRef.current = chart

    // Add candlestick series with current price line (like TradingView) on pane 0.
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      borderVisible: true,
      wickVisible: true,
      lastValueVisible: true, // Show current price tag on y-axis
      priceLineVisible: true, // Show horizontal line at current price
      priceLineWidth: 1,
      priceLineColor: '#2962FF',
      priceLineStyle: 2, // Dashed line
    })

    candlestickSeriesRef.current = candlestickSeries
    // v5 markers plugin (signal arrows) — created once, fed via candleMarkersRef.
    candleMarkersRef.current = createSeriesMarkers(candlestickSeries, [])

    // Add volume histogram series (pane 0, overlaid via the 'volume' price scale).
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      lastValueVisible: false,
      priceScaleId: 'volume',
    })

    // Configure volume price scale (pane 0)
    chart.priceScale('volume', 0).applyOptions({
      scaleMargins: volumeScaleMargins,
    })

    volumeSeriesRef.current = volumeSeries

    // RSI lives in its OWN native pane (pane index 1) with its own right price axis,
    // locked 0–100 by rsiAutoscaleTo100. Only built when RSI is on, so the screener
    // (RSI off, no rsiData) never creates pane 1 — keeping its layout unchanged.
    if (showRsi) {
      // Faint purple background shading the 30-70 RSI zone (Pine "RSI Background Fill",
      // color.rgb(126,87,194,90) ≈ #7E57C2 @ 10%). Implemented as a constant-70 baseline
      // series with baseValue 30 → its (flat) top fill paints exactly the 30-70 band.
      // Created BEFORE the RSI series so the line + overbought/oversold fills draw on top.
      const rsiBandSeries = chart.addSeries(
        BaselineSeries,
        {
          baseValue: { type: 'price', price: 30 },
          topFillColor1: RSI_BAND_COLOR,
          topFillColor2: RSI_BAND_COLOR,
          topLineColor: 'rgba(0, 0, 0, 0)',
          bottomFillColor1: 'rgba(0, 0, 0, 0)',
          bottomFillColor2: 'rgba(0, 0, 0, 0)',
          bottomLineColor: 'rgba(0, 0, 0, 0)',
          lineWidth: 1,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider: rsiAutoscaleTo100,
        },
        1
      )

      rsiBandSeriesRef.current = rsiBandSeries

      // Oversold fill (Pine-style `fill(rsi, mid, 30, 0, red, red)`): a baseline anchored
      // at the 30 boundary whose RED bottom fill paints ONLY the gap between 30 and the
      // line when oversold (RSI < 30) — clearly visible already at the 30 boundary and
      // intensifying toward 0, so even a shallow dip below 30 reads as red.
      // Everything above 30 is transparent. Its line is transparent so it never
      // double-draws the purple RSI line (rsiSeries owns that). Created before rsiSeries
      // so the line + overbought fill stack on top.
      const rsiOversoldSeries = chart.addSeries(
        BaselineSeries,
        {
          baseValue: { type: 'price', price: 30 },
          topLineColor: 'rgba(0, 0, 0, 0)',
          bottomLineColor: 'rgba(0, 0, 0, 0)',
          topFillColor1: 'rgba(0, 0, 0, 0)', // nothing above the 30 boundary
          topFillColor2: 'rgba(0, 0, 0, 0)',
          bottomFillColor1: 'rgba(239, 68, 68, 0.3)', // still clearly red at the 30 boundary
          bottomFillColor2: 'rgba(239, 68, 68, 0.85)', // strong red near 0 (deep oversold)
          lineWidth: 1, // line is transparent (rsiSeries draws the purple line)
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider: rsiAutoscaleTo100,
        },
        1
      )

      rsiOversoldSeriesRef.current = rsiOversoldSeries

      // RSI as a baseline series anchored at the 70 OVERBOUGHT boundary (TradingView-
      // style). The line stays a uniform theme purple; the GREEN top fill paints ONLY the
      // gap between 70 and the line when overbought (RSI > 70) — clearly visible already at
      // the 70 boundary and intensifying toward 100, so even a shallow poke above 70 reads
      // as green. Below 70 the fill is transparent — oversold red comes from
      // rsiOversoldSeries, the 30-70 shading from rsiBandSeries.
      const rsiSeries = chart.addSeries(
        BaselineSeries,
        {
          baseValue: { type: 'price', price: 70 },
          topLineColor: RSI_PURPLE,
          bottomLineColor: RSI_PURPLE,
          topFillColor1: 'rgba(16, 185, 129, 0.85)', // strong green near 100 (deep overbought)
          topFillColor2: 'rgba(16, 185, 129, 0.3)', // still clearly green at the 70 boundary
          bottomFillColor1: 'rgba(0, 0, 0, 0)', // no fill below 70
          bottomFillColor2: 'rgba(0, 0, 0, 0)',
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: false, // no horizontal line tracking the current RSI value
          autoscaleInfoProvider: rsiAutoscaleTo100,
        },
        1
      )

      rsiSeriesRef.current = rsiSeries
      // v5 markers plugin for the RSI divergence markers — created once, fed via ref.
      rsiMarkersRef.current = createSeriesMarkers(rsiSeries, [])

      // Configure the RSI pane's right axis (margins re-applied by the scale-margins effect)
      chart.priceScale('right', 1).applyOptions({ scaleMargins: rsiScaleMargins })
    }

    // Configure the price pane's right axis (pane 0). Previously implicit via the
    // rightPriceScale chartOptions; set explicitly now that scales are pane-scoped.
    chart.priceScale('right', 0).applyOptions({ scaleMargins: priceScaleMargins })

    // Subscribe to crosshair moves - update via ref for zero-delay performance (like TradingView)
    chart.subscribeCrosshairMove((param) => {
      if (!crosshairOverlayRef.current) return

      if (!param.point || !param.time) {
        crosshairOverlayRef.current.update({})
        return
      }

      const candleData = param.seriesData.get(candlestickSeries) as CandlestickData | undefined
      if (candleData) {
        crosshairOverlayRef.current.update({
          time: param.time as string,
          price: param.logical as number,
          OHLC: {
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close,
          },
        })
      }
    })

    // Handle resize with debounce
    let resizeTimeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (container && chartRef.current) {
          const newWidth = container.clientWidth
          chartRef.current.applyOptions({ width: newWidth })
        }
      }, 100)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
      chart.remove()
      trendlineSeriesRef.current = []
      volumeSeriesRef.current = null
      rsiSeriesRef.current = null
      rsiBandSeriesRef.current = null
      rsiOversoldSeriesRef.current = null
      rsiDivergenceSeriesRef.current = []
      rsiPriceLinesRef.current = []
      // Marker plugins are owned by their series; the chart.remove() above disposes
      // them, so just drop the refs (avoids calling into a removed plugin later).
      candleMarkersRef.current = null
      rsiMarkersRef.current = null
    }
    // volumeScaleMargins/priceScaleMargins/rsiScaleMargins are intentionally NOT
    // deps here — they change as the RSI divider is dragged and are re-applied by
    // the scale-margins effect below (no chart recreation, no flicker).
  }, [totalHeight, showRsi])

  // Re-apply the price/volume/RSI scale margins whenever they change (e.g. the
  // RSI divider drag updates rsiFraction). Uses applyOptions on the existing
  // chart — never recreates it — so trendlines/signals/RSI decorations persist.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.priceScale('right', 0).applyOptions({ scaleMargins: priceScaleMargins })
    if (volumeSeriesRef.current)
      chart.priceScale('volume', 0).applyOptions({ scaleMargins: volumeScaleMargins })
    if (rsiSeriesRef.current && chart.panes().length > 1)
      chart.priceScale('right', 1).applyOptions({ scaleMargins: rsiScaleMargins })
  }, [priceScaleMargins, volumeScaleMargins, rsiScaleMargins, showRsi, totalHeight])

  // Update price data with volume
  useEffect(() => {
    if (!candlestickSeriesRef.current || !priceHistory.length) return

    // Sort price history by date
    const sortedPriceHistory = [...priceHistory].sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })

    const candlestickData: CandlestickData[] = sortedPriceHistory.map(convertToCandlestickData)
    candlestickSeriesRef.current.setData(candlestickData)

    // Update volume data
    if (volumeSeriesRef.current && showVolume) {
      const hasValidVolume = sortedPriceHistory.some((p) => p.volume > 0)

      if (hasValidVolume) {
        const volumeData: HistogramData[] = sortedPriceHistory.map((price) => ({
          time: price.date as ChartTime,
          value: price.volume || 0,
          color: price.close >= price.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
        }))

        volumeSeriesRef.current.setData(volumeData)
      }
    }

    // Update RSI data + decorations (70/30 guide lines, divergence connector
    // lines, pivot markers). Colocated with the RSI setData — NOT the init effect,
    // which recreates rsiSeriesRef on every showRsi toggle. The whole block is
    // guarded by `showRsi && stableRsiData.length > 0`, so the screener (which
    // passes no rsiData) never triggers any RSI-pane decoration.
    if (rsiSeriesRef.current && showRsi && stableRsiData.length > 0) {
      const rsiSeries = rsiSeriesRef.current
      const rsiBaselineData: BaselineData[] = stableRsiData.map(convertToRsiBaselineData)
      rsiSeries.setData(rsiBaselineData)
      // Same data drives the oversold red fill (baseline 30) below the line.
      rsiOversoldSeriesRef.current?.setData(rsiBaselineData)

      // Shade the 30-70 zone purple across the FULL price-history range (every bar,
      // including the RSI warm-up at the left) so the band is always present — not just
      // where the RSI line exists. A flat constant-70 line over the baseValue-30 baseline
      // fills exactly that band. sortedPriceHistory is asc-ordered and aligns with the
      // candles, satisfying lightweight-charts' time-ordering requirement.
      rsiBandSeriesRef.current?.setData(
        sortedPriceHistory.map((p) => ({ time: p.date as ChartTime, value: 70 }))
      )

      // Reset prior decorations (handles symbol/priceHistory change without a rebuild)
      cleanupRsiDecorations()

      // Pine-faithful guide lines: 70/30 bands in opaque #787B86, the 50 midline in
      // the same gray at 50% transparency (Pine color.new(#787B86, 50)). Dashed,
      // thin, with right-axis labels — framing the boundaries without competing
      // with the green/red baseline fill.
      rsiPriceLinesRef.current.push(
        rsiSeries.createPriceLine({
          price: 70,
          color: '#787B86',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: '70',
        }),
        rsiSeries.createPriceLine({
          price: 50,
          color: 'rgba(120, 123, 134, 0.5)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: '50',
        }),
        rsiSeries.createPriceLine({
          price: 30,
          color: '#787B86',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: '30',
        })
      )

      // One sloped connector line series per divergence, in the RSI pane (pane 1)
      const divergenceLines = buildRsiDivergenceLines(stableDivergences, priceHistory)
      divergenceLines.forEach((line) => {
        const series = chartRef.current!.addSeries(
          LineSeries,
          {
            color: line.color,
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
            autoscaleInfoProvider: rsiAutoscaleTo100, // keep the rsi axis pinned to 0–100
          },
          1
        )
        series.setData(line.points.map((p) => ({ time: p.time as ChartTime, value: p.value })))
        rsiDivergenceSeriesRef.current.push(series)
      })

      // Divergence markers ON the RSI line (separate from the candlestick markers),
      // driven through the v5 markers plugin instead of the removed series.setMarkers.
      const rsiMarkers = buildRsiMarkers(stableDivergences, priceHistory)
      rsiMarkersRef.current?.setMarkers(
        rsiMarkers.map((m) => ({
          time: m.time as ChartTime,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text,
        }))
      )
    } else if (rsiSeriesRef.current) {
      // RSI hidden / no data: clear the line, band, oversold fill, decorations, markers
      cleanupRsiDecorations()
      rsiSeriesRef.current.setData([])
      rsiMarkersRef.current?.setMarkers([])
      rsiBandSeriesRef.current?.setData([])
      rsiOversoldSeriesRef.current?.setData([])
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
      chartRef.current.timeScale().scrollToPosition(0, false)
      // Record the laid-out time-axis height so the RSI divider aligns to the drawing area.
      setTimeAxisHeight(chartRef.current.timeScale().height())
      // Size the native RSI pane (pane 1) to rsiFraction of the drawing area (canvas −
      // time axis), so the draggable divider re-proportions the panes like before.
      if (showRsi && chartRef.current.panes().length > 1) {
        const drawing = Math.max(1, totalHeight - chartRef.current.timeScale().height())
        chartRef.current.panes()[1].setHeight(Math.round(rsiFraction * drawing))
      }
    }
    // `totalHeight` re-applies the data after the init effect rebuilds the chart on an RSI/height toggle.
  }, [
    priceHistory,
    showVolume,
    showRsi,
    stableRsiData,
    stableDivergences,
    cleanupRsiDecorations,
    totalHeight,
    rsiFraction,
  ])

  // Add trendlines
  useEffect(() => {
    if (!chartRef.current || !extendedTrendlines.length || !showTrendlines) {
      cleanupTrendlineSeries()
      return
    }

    cleanupTrendlineSeries()

    const chart = chartRef.current

    extendedTrendlines.forEach((trendline) => {
      const isSupport = trendline.type === 'uptrend_support'
      const lineColor = isSupport ? '#10b981' : '#ef4444'

      const lineSeries = chart.addSeries(LineSeries, {
        color: lineColor,
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        pointMarkersVisible: false,
      })

      const startDate = new Date(trendline.start_date).getTime()

      const lineData: LineData[] = trendline.data_points
        .filter((point: { date: string; price: number }) => {
          const pointDate = new Date(point.date).getTime()
          return pointDate >= startDate
        })
        .map(convertTrendlinePoint)

      lineSeries.setData(lineData)
      trendlineSeriesRef.current.push(lineSeries)
    })

    return () => {
      cleanupTrendlineSeries()
    }
    // `totalHeight` re-adds the trendlines after the init effect rebuilds the chart on an RSI/height toggle.
  }, [extendedTrendlines, showTrendlines, cleanupTrendlineSeries, totalHeight])

  // Add signal markers
  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    if (!showSignals || !stableSignals.length) {
      candleMarkersRef.current?.setMarkers([])
      return
    }

    const sortedSignals = [...stableSignals].sort((a, b) => {
      const timeA = new Date(a.time).getTime()
      const timeB = new Date(b.time).getTime()
      return timeA - timeB
    })

    const markers = sortedSignals.map((signal) => {
      const isBullish = signal.type.includes('breakout') // breakout above resistance = bullish
      const color = isBullish ? '#10b981' : '#ef4444'
      const shape = isBullish ? 'arrowUp' : 'arrowDown'
      const confirmed = isSignalConfirmed(signal)

      return {
        time: signal.time as ChartTime,
        position: isBullish ? ('belowBar' as const) : ('aboveBar' as const),
        color,
        shape: shape as 'arrowUp' | 'arrowDown',
        text: confirmed ? '✓' : 'P',
        size: confirmed ? 2 : 1.5,
      }
    })

    candleMarkersRef.current?.setMarkers(markers)
    // `totalHeight` re-adds the signal markers after the init effect rebuilds the chart (see trendlines effect).
  }, [stableSignals, showSignals, totalHeight])

  // Format helpers
  const formatPrice = (value: number): string => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const hasData = priceHistory.length > 0
  const latestPrice = priceHistory[priceHistory.length - 1]
  const priceChange =
    priceHistory.length > 1
      ? ((latestPrice.close - priceHistory[priceHistory.length - 2].close) /
          priceHistory[priceHistory.length - 2].close) *
        100
      : 0

  // Drag the RSI divider: convert the pointer Y (relative to the chart canvas) into
  // the bottom RSI fraction, clamped so neither the price nor the RSI pane collapses.
  const onRsiDividerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const el = chartContainerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      // Capture the pointer on the divider element itself (not window): the listeners
      // live on the element, so they're torn down automatically if the chart unmounts
      // mid-drag (refitNonce remount, navigation, RSI toggle) — no leak, no setState
      // after unmount. pointercancel covers interrupted touch/stylus drags.
      const handle = e.currentTarget
      handle.setPointerCapture(e.pointerId)
      // Map against the drawing area (canvas − time axis), matching the RSI scaleMargins.
      const paneH = Math.max(1, rect.height - timeAxisHeight)
      const move = (ev: PointerEvent) => {
        const frac = 1 - (ev.clientY - rect.top) / paneH
        setRsiFraction(Math.min(0.45, Math.max(0.18, frac)))
      }
      const end = () => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', end)
        handle.removeEventListener('pointercancel', end)
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', end)
      handle.addEventListener('pointercancel', end)
    },
    [timeAxisHeight]
  )

  const showRsiDivider = showRsi && stableRsiData.length > 0

  return (
    <div className={cn('relative', fillHeight && 'flex h-full min-h-0 flex-col', className)}>
      {hasData ? (
        <>
          {/* Chart Controls Toolbar */}
          <div
            className={cn(
              'flex items-center justify-between mb-3 px-1',
              fillHeight && 'flex-shrink-0'
            )}
          >
            {/* Price Info Display */}
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[var(--text-muted)] text-xs">Latest: </span>
                <span className="font-semibold text-lg">{formatPrice(latestPrice.close)}</span>
                <span
                  className={cn(
                    'ml-2 text-sm font-medium',
                    priceChange >= 0 ? 'text-[var(--neon-bull)]' : 'text-[var(--neon-bear)]'
                  )}
                >
                  {priceChange >= 0 ? '+' : ''}
                  {priceChange.toFixed(2)}%
                </span>
              </div>
              <div className="text-[var(--text-muted)] text-xs">
                O:{' '}
                <span className="text-[var(--text-primary)]">{formatPrice(latestPrice.open)}</span>{' '}
                H:{' '}
                <span className="text-[var(--text-primary)]">{formatPrice(latestPrice.high)}</span>{' '}
                L:{' '}
                <span className="text-[var(--text-primary)]">{formatPrice(latestPrice.low)}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <ChartControls
              zoomPercentage={zoomPercentage}
              canZoomIn={canZoomIn}
              canZoomOut={canZoomOut}
              showNavZoom={showNavZoom}
              intervalControl={intervalControl}
              showTrendlines={showTrendlines}
              showSignals={showSignals}
              showRsi={showRsi}
              hasRsiData={stableRsiData.length > 0}
              chartHeight={chartHeight}
              showHeightToggle={!fillHeight}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onResetZoom={resetZoom}
              onGoToStart={goToStart}
              onGoToEnd={goToEnd}
              onScrollLeft={scrollLeft}
              onScrollRight={scrollRight}
              onToggleTrendlines={() => setShowTrendlines(!showTrendlines)}
              onToggleSignals={() => setShowSignals(!showSignals)}
              onToggleRsi={() => {
                const next = !showRsi
                setShowRsi(next)
                onShowRsiChange?.(next)
              }}
              onToggleChartHeight={() =>
                setChartHeight((h) => (h === initialHeight ? initialHeight + 220 : initialHeight))
              }
            />
          </div>

          {/* Chart Container */}
          <div className={cn('relative', fillHeight && 'min-h-0 flex-1')}>
            <div
              ref={chartContainerRef}
              className={cn('w-full rounded-lg overflow-hidden', fillHeight && 'h-full')}
              data-testid="chart-container"
            />

            {/* Draggable divider between the price pane and the native RSI pane (RSI only). */}
            {showRsiDivider && (
              <div
                data-testid="rsi-divider"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Drag to resize the RSI pane"
                onPointerDown={onRsiDividerPointerDown}
                className="group absolute inset-x-0 z-20 flex h-3 -translate-y-1/2 cursor-row-resize items-center justify-center"
                style={{ top: `${(1 - rsiFraction) * paneHeight}px` }}
              >
                <div className="absolute inset-x-0 h-px bg-[var(--border-dim)] group-hover:bg-[var(--neon-cyan)] transition-colors" />
                <div className="absolute h-1 w-12 rounded-full bg-[var(--text-muted)]/40 group-hover:bg-[var(--neon-cyan)] transition-colors" />
              </div>
            )}

            <CrosshairOverlay ref={crosshairOverlayRef} />
          </div>

          {/* Enhanced Legend */}
          <ChartLegend
            trendlines={extendedTrendlines}
            signals={stableSignals}
            showTrendlines={showTrendlines}
            showSignals={showSignals}
            showRsi={showRsi}
            rsiData={stableRsiData}
            priceHistoryLength={priceHistory.length}
            symbol={symbol}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-[400px] text-[var(--text-muted)]">
          <svg
            className="w-12 h-12 mb-3 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
          <span className="text-sm">No price data available for {symbol}</span>
        </div>
      )}
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export const PriceChart = memo(PriceChartComponent, (prevProps, nextProps) => {
  return (
    prevProps.symbol === nextProps.symbol &&
    prevProps.priceHistory.length === nextProps.priceHistory.length &&
    prevProps.priceHistory[prevProps.priceHistory.length - 1]?.close ===
      nextProps.priceHistory[nextProps.priceHistory.length - 1]?.close &&
    prevProps.trendlines?.length === nextProps.trendlines?.length &&
    prevProps.signals?.length === nextProps.signals?.length &&
    prevProps.rsiData?.length === nextProps.rsiData?.length &&
    prevProps.divergences?.length === nextProps.divergences?.length &&
    prevProps.showNavZoom === nextProps.showNavZoom &&
    prevProps.intervalControl?.value === nextProps.intervalControl?.value
  )
})
