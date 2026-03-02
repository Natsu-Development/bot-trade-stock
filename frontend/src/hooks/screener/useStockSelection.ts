import { useState, useCallback } from 'react'
import type { Stock } from '@/types'

export interface UseStockSelectionResult {
  selectedStocks: Set<string>
  showWatchlistModal: boolean
  setShowWatchlistModal: (show: boolean) => void
  handleToggleStockSelection: (symbol: string) => void
  handleToggleAllSelection: () => void
  clearSelection: () => void
  selectAllStocks: () => void
}

export function useStockSelection(stocks: Stock[]): UseStockSelectionResult {
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())
  const [showWatchlistModal, setShowWatchlistModal] = useState(false)

  const handleToggleStockSelection = useCallback((symbol: string) => {
    setSelectedStocks(prev => {
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
    setSelectedStocks(prev => {
      if (prev.size === stocks.length) {
        return new Set()
      }
      return new Set(stocks.map(s => s.symbol))
    })
  }, [stocks])

  const clearSelection = useCallback(() => {
    setSelectedStocks(new Set())
  }, [])

  const selectAllStocks = useCallback(() => {
    setSelectedStocks(new Set(stocks.map(s => s.symbol)))
  }, [stocks])

  return {
    selectedStocks,
    showWatchlistModal,
    setShowWatchlistModal,
    handleToggleStockSelection,
    handleToggleAllSelection,
    clearSelection,
    selectAllStocks,
  }
}
