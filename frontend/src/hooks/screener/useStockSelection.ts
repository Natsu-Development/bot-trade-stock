import { useState, useCallback } from 'react'
import type { Stock } from '@/types'

export interface UseStockSelectionResult {
  selectedStocks: Set<string>
  handleToggleStockSelection: (symbol: string) => void
  handleToggleAllSelection: () => void
  clearSelection: () => void
}

export function useStockSelection(stocks: Stock[]): UseStockSelectionResult {
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())

  const handleToggleStockSelection = useCallback((symbol: string) => {
    setSelectedStocks((prev) => {
      const newSelection = new Set(prev)
      if (newSelection.has(symbol)) {
        newSelection.delete(symbol)
      } else {
        newSelection.add(symbol)
      }
      return newSelection
    })
  }, [])

  const handleToggleAllSelection = useCallback(() => {
    setSelectedStocks((prev) => {
      if (prev.size === stocks.length) {
        return new Set()
      }
      return new Set(stocks.map((s) => s.symbol))
    })
  }, [stocks])

  const clearSelection = useCallback(() => {
    setSelectedStocks(new Set())
  }, [])

  return {
    selectedStocks,
    handleToggleStockSelection,
    handleToggleAllSelection,
    clearSelection,
  }
}
