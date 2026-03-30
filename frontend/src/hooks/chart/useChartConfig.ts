import { useMemo } from 'react'
import { ColorType, CrosshairMode } from 'lightweight-charts'

export interface ChartConfig {
  width: number
  height: number
}

export interface ZoomConfig {
  minBarSpacing: number
  maxBarSpacing: number
  defaultBarSpacing: number
  zoomStep: number
  scrollStep: number
}

export const ZOOM_CONFIG: ZoomConfig = {
  minBarSpacing: 2,
  maxBarSpacing: 50,
  defaultBarSpacing: 12,
  zoomStep: 2,
  scrollStep: 20,
}

export function useChartConfig(containerWidth: number, chartHeight: number, showVolume: boolean, showRsi: boolean) {
  // Calculate total height based on visible indicators
  const totalHeight = useMemo(() => {
    const volumeHeight = showVolume ? 100 : 0
    const rsiHeight = showRsi ? 100 : 0
    return chartHeight + volumeHeight + rsiHeight
  }, [chartHeight, showVolume, showRsi])

  // Calculate volume scale margins based on RSI visibility
  const volumeScaleMargins = useMemo(() => ({
    top: showRsi ? 0.5 : 0.75,
    bottom: showRsi ? 0.2 : 0,
  }), [showRsi])

  // Calculate price scale margins based on RSI visibility
  // Small margins to show full price range (like TradingView)
  const priceScaleMargins = useMemo(() => ({
    top: 0.05,
    bottom: showRsi ? 0.5 : 0.1,
  }), [showRsi])

  // Chart options
  const chartOptions = useMemo(() => ({
    width: containerWidth,
    height: totalHeight,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: 'rgba(132, 142, 156, 0.9)',
    },
    grid: {
      vertLines: {
        color: 'rgba(142, 148, 156, 0.08)',
        style: 2, // dashed
      },
      horzLines: {
        color: 'rgba(142, 148, 156, 0.08)',
        style: 2, // dashed
      },
    },
    crosshair: {
      mode: CrosshairMode.Magnet,
      vertLine: {
        color: 'rgba(255, 255, 255, 0.3)',
        width: 1,
        style: 3, // dotted
        labelBackgroundColor: 'rgba(0, 150, 255, 0.8)',
      },
      horzLine: {
        color: 'rgba(255, 255, 255, 0.3)',
        width: 1,
        style: 3, // dotted
        labelBackgroundColor: 'rgba(0, 150, 255, 0.8)',
      },
    },
    rightPriceScale: {
      visible: true,
      borderVisible: true,
      borderColor: 'rgba(142, 148, 156, 0.15)',
      scaleMargins: priceScaleMargins,
      entireTextOnly: false,
    },
    timeScale: {
      borderColor: 'rgba(142, 148, 156, 0.15)',
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 5,
      barSpacing: ZOOM_CONFIG.defaultBarSpacing,
      minBarSpacing: ZOOM_CONFIG.minBarSpacing,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  }), [containerWidth, totalHeight, priceScaleMargins])

  return {
    totalHeight,
    volumeScaleMargins,
    priceScaleMargins,
    chartOptions,
  }
}
