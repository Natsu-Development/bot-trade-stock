import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
} from 'lightweight-charts'
import { cn } from '@/lib/utils'
import { isSignalConfirmed, type ApiPriceData, ApiTrendlineDisplay, ApiTradingSignal, ApiAnalysisSignal } from '@/lib/api'
import { extendTrendlinesToCrossover } from '@/lib/trendlineUtils'
import { useChartConfig } from '@/hooks/chart/useChartConfig'
import { useChartControls } from '@/hooks/chart/useChartControls'
import { useChartKeyboard } from '@/hooks/chart/useChartKeyboard'
import { ChartControls } from '@/components/chart/ChartControls'
import { ChartLegend } from '@/components/chart/ChartLegend'
import { CrosshairOverlay, type CrosshairOverlayRef } from '@/components/chart/CrosshairOverlay'
import { ChartShortcutsHint } from '@/components/chart/ChartShortcutsHint'
import type { ChartTime, ChartCandlestickData, ChartLineData } from '@/types/chart'

interface PriceChartProps {
  symbol: string
  priceHistory: ApiPriceData[]
  trendlines?: ApiTrendlineDisplay[]
  signals?: ApiTradingSignal[]
  analysisSignals?: ApiAnalysisSignal[]  // Signals from analyze API with price_line for trendline extension
  rsiData?: Array<{ time: string; value: number }>
  className?: string
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

// Convert API RSI data to chart line data
function convertToLineData(rsi: { time: string; value: number }): ChartLineData {
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
  analysisSignals: propAnalysisSignals,
  rsiData: propRsiData,
  className
}: PriceChartProps) {
  // Use stable empty arrays for default props to prevent infinite loops
  const stableTrendlines = useMemo(() => propTrendlines ?? [], [propTrendlines])
  const stableSignals = useMemo(() => propSignals ?? [], [propSignals])
  const stableAnalysisSignals = useMemo(() => propAnalysisSignals ?? [], [propAnalysisSignals])
  const stableRsiData = useMemo(() => propRsiData ?? [], [propRsiData])

  // Extend trendlines to crossover points when signals are available
  // Pass priceHistory so we can calculate intermediate points along the slope
  const extendedTrendlines = useMemo(() => {
    return extendTrendlinesToCrossover(stableTrendlines, stableAnalysisSignals, priceHistory)
  }, [stableTrendlines, stableAnalysisSignals, priceHistory])

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const trendlineSeriesRef = useRef<ISeriesApi<'Line'>[]>([])
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const crosshairOverlayRef = useRef<CrosshairOverlayRef>(null)

  const [chartHeight, setChartHeight] = useState(400)
  const [showTrendlines, setShowTrendlines] = useState(true)
  const [showSignals, setShowSignals] = useState(true)
  const showVolume = true // Always show volume
  const [showRsi, setShowRsi] = useState(false)

  // Chart configuration hook
  const { totalHeight, volumeScaleMargins, chartOptions } = useChartConfig(
    chartContainerRef.current?.clientWidth ?? 0,
    chartHeight,
    showVolume,
    showRsi
  )

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

  // Keyboard shortcuts hook
  useChartKeyboard({
    zoomIn,
    zoomOut,
    resetZoom,
    goToStart,
    goToEnd,
    scrollLeft,
    scrollRight,
  })

  // Cleanup trendline series
  const cleanupTrendlineSeries = useCallback(() => {
    if (chartRef.current && trendlineSeriesRef.current.length > 0) {
      trendlineSeriesRef.current.forEach(series => {
        try {
          chartRef.current?.removeSeries(series)
        } catch {
          // Series already removed
        }
      })
      trendlineSeriesRef.current = []
    }
  }, [])

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

    // Add candlestick series with current price line (like TradingView)
    const candlestickSeries = chart.addCandlestickSeries({
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

    // Add volume histogram series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      lastValueVisible: false,
      priceScaleId: 'volume',
    })

    // Configure volume price scale
    chart.priceScale('volume').applyOptions({
      scaleMargins: volumeScaleMargins,
    })

    volumeSeriesRef.current = volumeSeries

    // Add RSI line series
    const rsiSeries = chart.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
      priceScaleId: 'rsi',
      lastValueVisible: true,
      pointMarkersVisible: false,
    })

    rsiSeriesRef.current = rsiSeries

    // Configure RSI price scale
    chart.priceScale('rsi').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

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
    }
  }, [totalHeight, volumeScaleMargins, showRsi])

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
      const hasValidVolume = sortedPriceHistory.some(p => p.volume > 0)

      if (hasValidVolume) {
        const volumeData: HistogramData[] = sortedPriceHistory.map((price) => ({
          time: price.date as ChartTime,
          value: price.volume || 0,
          color: price.close >= price.open
            ? 'rgba(16, 185, 129, 0.5)'
            : 'rgba(239, 68, 68, 0.5)',
        }))

        volumeSeriesRef.current.setData(volumeData)
      }
    }

    // Update RSI data
    if (rsiSeriesRef.current && showRsi && stableRsiData.length > 0) {
      const rsiLineData: LineData[] = stableRsiData.map(convertToLineData)
      rsiSeriesRef.current.setData(rsiLineData)
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
      chartRef.current.timeScale().scrollToPosition(0, false)
    }
  }, [priceHistory, showVolume, showRsi, stableRsiData])

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

      const lineSeries = chart.addLineSeries({
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
  }, [extendedTrendlines, showTrendlines, cleanupTrendlineSeries])

  // Add signal markers
  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    const series = candlestickSeriesRef.current

    if (!showSignals || !stableSignals.length) {
      series.setMarkers([])
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

    series.setMarkers(markers)
  }, [stableSignals, showSignals])

  // Format helpers
  const formatPrice = (value: number): string => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const hasData = priceHistory.length > 0
  const latestPrice = priceHistory[priceHistory.length - 1]
  const priceChange = priceHistory.length > 1
    ? ((latestPrice.close - priceHistory[priceHistory.length - 2].close) / priceHistory[priceHistory.length - 2].close) * 100
    : 0

  return (
    <div className={cn('relative', className)}>
      {hasData ? (
        <>
          {/* Chart Controls Toolbar */}
          <div className="flex items-center justify-between mb-3 px-1">
            {/* Price Info Display */}
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[var(--text-muted)] text-xs">Latest: </span>
                <span className="font-semibold text-lg">{formatPrice(latestPrice.close)}</span>
                <span className={cn(
                  'ml-2 text-sm font-medium',
                  priceChange >= 0 ? 'text-[var(--neon-bull)]' : 'text-[var(--neon-bear)]'
                )}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              </div>
              <div className="text-[var(--text-muted)] text-xs">
                O: <span className="text-[var(--text-primary)]">{formatPrice(latestPrice.open)}</span>
                {' '}H: <span className="text-[var(--text-primary)]">{formatPrice(latestPrice.high)}</span>
                {' '}L: <span className="text-[var(--text-primary)]">{formatPrice(latestPrice.low)}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <ChartControls
              zoomPercentage={zoomPercentage}
              canZoomIn={canZoomIn}
              canZoomOut={canZoomOut}
              showTrendlines={showTrendlines}
              showSignals={showSignals}
              showRsi={showRsi}
              hasRsiData={stableRsiData.length > 0}
              chartHeight={chartHeight}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onResetZoom={resetZoom}
              onGoToStart={goToStart}
              onGoToEnd={goToEnd}
              onScrollLeft={scrollLeft}
              onScrollRight={scrollRight}
              onToggleTrendlines={() => setShowTrendlines(!showTrendlines)}
              onToggleSignals={() => setShowSignals(!showSignals)}
              onToggleRsi={() => setShowRsi(!showRsi)}
              onToggleChartHeight={() => setChartHeight(h => h === 400 ? 550 : 400)}
            />
          </div>

          {/* Chart Container */}
          <div className="relative">
            <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" data-testid="chart-container" />

            <CrosshairOverlay ref={crosshairOverlayRef} />
            <ChartShortcutsHint />
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
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
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
    prevProps.priceHistory[prevProps.priceHistory.length - 1]?.close === nextProps.priceHistory[nextProps.priceHistory.length - 1]?.close &&
    prevProps.trendlines?.length === nextProps.trendlines?.length &&
    prevProps.signals?.length === nextProps.signals?.length &&
    prevProps.analysisSignals?.length === nextProps.analysisSignals?.length &&
    prevProps.rsiData?.length === nextProps.rsiData?.length
  )
})
