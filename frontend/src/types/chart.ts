import type { Time } from 'lightweight-charts'

// Proper type definitions for lightweight-charts data
export type ChartTime = Time

export interface ChartCandlestickData {
  time: ChartTime
  open: number
  high: number
  low: number
  close: number
}

export interface ChartLineData {
  time: ChartTime
  value: number
}

export interface ChartHistogramData {
  time: ChartTime
  value: number
  color?: string
}

export interface ChartCrosshairInfo {
  time?: string
  price?: number
  OHLC?: {
    open: number
    high: number
    low: number
    close: number
  }
}
