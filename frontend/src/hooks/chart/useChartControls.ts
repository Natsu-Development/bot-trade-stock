import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type { IChartApi } from 'lightweight-charts'
import { ZOOM_CONFIG } from './useChartConfig'

export interface ChartControlsResult {
  barSpacing: number
  zoomPercentage: number
  canZoomIn: boolean
  canZoomOut: boolean
  setBarSpacing: (spacing: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  goToStart: () => void
  goToEnd: () => void
  scrollLeft: () => void
  scrollRight: () => void
}

export function useChartControls(chartRef: React.MutableRefObject<IChartApi | null>): ChartControlsResult {
  const [barSpacing, setBarSpacing] = useState(ZOOM_CONFIG.defaultBarSpacing)
  const barSpacingRef = useRef(barSpacing)

  // Update ref when barSpacing changes (separate effect to avoid closure issues)
  useEffect(() => {
    barSpacingRef.current = barSpacing
  }, [barSpacing])

  // Calculate zoom percentage
  const zoomPercentage = useMemo(() => {
    const range = ZOOM_CONFIG.maxBarSpacing - ZOOM_CONFIG.minBarSpacing
    const current = barSpacing - ZOOM_CONFIG.minBarSpacing
    return Math.round((current / range) * 100)
  }, [barSpacing])

  // Check if zoom actions are available
  const canZoomIn = useMemo(() => barSpacing < ZOOM_CONFIG.maxBarSpacing, [barSpacing])
  const canZoomOut = useMemo(() => barSpacing > ZOOM_CONFIG.minBarSpacing, [barSpacing])

  // Zoom controls - use the chart's built-in methods
  const zoomIn = useCallback(() => {
    if (!chartRef.current) return
    const timeScale = chartRef.current.timeScale()
    const currentSpacing = timeScale.options().barSpacing ?? barSpacingRef.current
    const newSpacing = Math.min(currentSpacing + ZOOM_CONFIG.zoomStep, ZOOM_CONFIG.maxBarSpacing)
    chartRef.current.applyOptions({
      timeScale: { barSpacing: newSpacing }
    })
    barSpacingRef.current = newSpacing
    setBarSpacing(newSpacing)
  }, [chartRef])

  const zoomOut = useCallback(() => {
    if (!chartRef.current) return
    const timeScale = chartRef.current.timeScale()
    const currentSpacing = timeScale.options().barSpacing ?? barSpacingRef.current
    const newSpacing = Math.max(currentSpacing - ZOOM_CONFIG.zoomStep, ZOOM_CONFIG.minBarSpacing)
    chartRef.current.applyOptions({
      timeScale: { barSpacing: newSpacing }
    })
    barSpacingRef.current = newSpacing
    setBarSpacing(newSpacing)
  }, [chartRef])

  const resetZoom = useCallback(() => {
    if (!chartRef.current) return
    chartRef.current.timeScale().fitContent()
    barSpacingRef.current = ZOOM_CONFIG.defaultBarSpacing
    setBarSpacing(ZOOM_CONFIG.defaultBarSpacing)
  }, [chartRef])

  // Navigation controls
  const goToStart = useCallback(() => {
    if (!chartRef.current) return
    chartRef.current.timeScale().scrollToPosition(-100, false)
  }, [chartRef])

  const goToEnd = useCallback(() => {
    if (!chartRef.current) return
    chartRef.current.timeScale().scrollToPosition(0, true)
  }, [chartRef])

  const scrollLeft = useCallback(() => {
    if (!chartRef.current) return
    chartRef.current.timeScale().scrollToPosition(-ZOOM_CONFIG.scrollStep, false)
  }, [chartRef])

  const scrollRight = useCallback(() => {
    if (!chartRef.current) return
    chartRef.current.timeScale().scrollToPosition(ZOOM_CONFIG.scrollStep, false)
  }, [chartRef])

  return {
    barSpacing,
    zoomPercentage,
    canZoomIn,
    canZoomOut,
    setBarSpacing,
    zoomIn,
    zoomOut,
    resetZoom,
    goToStart,
    goToEnd,
    scrollLeft,
    scrollRight,
  }
}
