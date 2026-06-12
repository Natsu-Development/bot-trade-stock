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

export function useChartConfig(
  containerWidth: number,
  chartHeight: number,
  showVolume: boolean,
  showRsi: boolean,
  /**
   * Fill-mode height in px (screener). When > 0 it BECOMES the total height — the
   * chart spans its whole pane instead of the fixed price+volume+rsi formula. The
   * caller measures the container (ResizeObserver) and passes the result here.
   */
  fillHeightPx = 0
) {
  // Calculate total height based on visible indicators
  const totalHeight = useMemo(() => {
    if (fillHeightPx > 0) return fillHeightPx
    const volumeHeight = showVolume ? 100 : 0
    const rsiHeight = showRsi ? 100 : 0
    return chartHeight + volumeHeight + rsiHeight
  }, [chartHeight, showVolume, showRsi, fillHeightPx])

  // RSI now lives in its OWN native pane (pane 1), so the price/volume margins no
  // longer have to leave room for it at the bottom of pane 0 — they're fixed and
  // never depend on rsiFraction. The RSI pane's pixel height is driven separately
  // by chart.panes()[1].setHeight() (see PriceChart's data effect); rsiFraction only
  // feeds that height calc, not these scale margins.
  // Price pane (pane 0): a little top headroom + bottom room for the volume overlay.
  const priceScaleMargins = useMemo(() => ({ top: 0.05, bottom: 0.2 }), [])

  // Volume overlay (pane 0, 'volume' scale): pinned to the bottom 20% of the pane.
  const volumeScaleMargins = useMemo(() => ({ top: 0.8, bottom: 0 }), [])

  // RSI pane (pane 1, native right axis locked 0–100): RSI ~fills the pane with a
  // touch of top/bottom padding so the line never kisses the separator or time axis.
  const rsiScaleMargins = useMemo(() => ({ top: 0.08, bottom: 0.08 }), [])

  // Chart options
  const chartOptions = useMemo(
    () => ({
      width: containerWidth,
      height: totalHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(132, 142, 156, 0.9)',
        // v5 shows a TradingView attribution logo on the main pane by default; hide it for
        // the clean terminal look (lightweight-charts is Apache-2.0 — the NOTICE ships in
        // node_modules; surface attribution in the app's licenses if required).
        attributionLogo: false,
        // Native v5 panes: disable the built-in pane resize (we keep the custom RSI
        // divider) but style the separator to match the theme.
        panes: {
          enableResize: false,
          separatorColor: 'rgba(142, 148, 156, 0.2)',
          separatorHoverColor: 'rgba(142, 148, 156, 0.35)',
        },
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
        mode: CrosshairMode.Normal, // Follow mouse freely like TradingView
        vertLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
          style: 3, // dotted
          labelBackgroundColor: '#2962FF',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
          style: 3, // dotted
          labelBackgroundColor: '#2962FF',
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
    }),
    [containerWidth, totalHeight, priceScaleMargins]
  )

  return {
    totalHeight,
    volumeScaleMargins,
    priceScaleMargins,
    rsiScaleMargins,
    chartOptions,
  }
}
