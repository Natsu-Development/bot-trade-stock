import { useState, useCallback, useMemo } from 'react'

export interface TableColumn {
  id: string
  label: string
  shortLabel?: string
  category: 'basic' | 'rs' | 'volume' | 'price' | 'ma' | 'signal'
  defaultVisible: boolean
}

// All available columns for stock tables
export const ALL_COLUMNS: TableColumn[] = [
  // Basic columns
  { id: 'symbol', label: 'Symbol', category: 'basic', defaultVisible: true },
  { id: 'exchange', label: 'Exchange', category: 'basic', defaultVisible: true },
  
  // RS Rating columns
  { id: 'rs1m', label: 'RS 1M', shortLabel: '1M', category: 'rs', defaultVisible: true },
  { id: 'rs3m', label: 'RS 3M', shortLabel: '3M', category: 'rs', defaultVisible: true },
  { id: 'rs6m', label: 'RS 6M', shortLabel: '6M', category: 'rs', defaultVisible: false },
  { id: 'rs9m', label: 'RS 9M', shortLabel: '9M', category: 'rs', defaultVisible: false },
  { id: 'rs52w', label: 'RS 52W', shortLabel: '52W', category: 'rs', defaultVisible: true },
  
  // Volume columns
  { id: 'volumeVsSma', label: 'Vol/SMA', category: 'volume', defaultVisible: true },
  { id: 'currentVolume', label: 'Volume', category: 'volume', defaultVisible: false },
  
  // Price columns
  { id: 'price', label: 'Price', category: 'price', defaultVisible: true },
  { id: 'change', label: 'Chg%', category: 'price', defaultVisible: true },
  
  // Moving Average columns
  { id: 'ema9', label: 'EMA9', category: 'ma', defaultVisible: true },
  { id: 'ema21', label: 'EMA21', category: 'ma', defaultVisible: true },
  { id: 'ema50', label: 'EMA50', category: 'ma', defaultVisible: true },
  { id: 'sma200', label: 'SMA200', category: 'ma', defaultVisible: true },
  
  // Signal columns
  { id: 'signals', label: 'Signals', category: 'signal', defaultVisible: true },
]

// Storage key for persisting column preferences
const STORAGE_KEY = 'stock-table-columns'

// Load saved column visibility from localStorage
function loadSavedColumns(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return new Set(JSON.parse(saved))
    }
  } catch {
    // Ignore parse errors
  }
  // Return default visible columns
  return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id))
}

// Save column visibility to localStorage
function saveColumns(visibleColumns: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visibleColumns]))
  } catch {
    // Ignore storage errors
  }
}

export function useTableColumns() {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => loadSavedColumns())

  const toggleColumn = useCallback((columnId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(columnId)) {
        // Don't allow hiding symbol column
        if (columnId !== 'symbol') {
          next.delete(columnId)
        }
      } else {
        next.add(columnId)
      }
      saveColumns(next)
      return next
    })
  }, [])

  const setColumns = useCallback((columnIds: string[]) => {
    const next = new Set(columnIds)
    // Always include symbol
    next.add('symbol')
    setVisibleColumns(next)
    saveColumns(next)
  }, [])

  const resetToDefaults = useCallback(() => {
    const defaults = new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id))
    setVisibleColumns(defaults)
    saveColumns(defaults)
  }, [])

  const isVisible = useCallback((columnId: string) => {
    return visibleColumns.has(columnId)
  }, [visibleColumns])

  // Group columns by category for UI display
  const columnsByCategory = useMemo(() => {
    const categories = {
      basic: { label: 'Basic', columns: [] as TableColumn[] },
      rs: { label: 'RS Rating', columns: [] as TableColumn[] },
      volume: { label: 'Volume', columns: [] as TableColumn[] },
      price: { label: 'Price', columns: [] as TableColumn[] },
      ma: { label: 'Moving Avg', columns: [] as TableColumn[] },
      signal: { label: 'Signals', columns: [] as TableColumn[] },
    }
    ALL_COLUMNS.forEach(col => {
      categories[col.category].columns.push(col)
    })
    return categories
  }, [])

  return {
    visibleColumns,
    toggleColumn,
    setColumns,
    resetToDefaults,
    isVisible,
    columnsByCategory,
    allColumns: ALL_COLUMNS,
  }
}
