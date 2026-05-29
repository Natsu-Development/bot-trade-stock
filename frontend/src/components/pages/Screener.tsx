import { useState, useCallback, useEffect, useMemo, useRef, useDeferredValue } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '../icons/Icons'
import { api } from '../../lib/api'
import { toast } from '../ui/Toast'
import { handleError } from '../../lib/errors'
import {
  transformApiStocks,
  sortStocks,
  isSortableColumn,
  isNumericSortField,
  type ScreenerSortField,
  type SortDirection,
} from '../../lib/screenerUtils'
import { FilterBar } from '../screener/FilterBar'
import { SaveFilterPresetDialog } from '../screener/SaveFilterPresetDialog'
import { ScreenerResultsTable } from '../screener/ScreenerResultsTable'
import { ColumnSelector } from '../screener/ColumnSelector'
import { useScreenerFilters } from '../../hooks/screener/useScreenerFilters'
import { useStockSelection } from '../../hooks/screener/useStockSelection'
import { useTableColumns } from '../../hooks/useTableColumns'
import { SearchBox } from '../features/SearchBox'
import type { Stock } from '../../types'
import { SCREENER_FIELD_OPTIONS, SCREENER_OPERATOR_OPTIONS } from '@/lib/screenerFilterOptions'

export function Screener() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [activeExchange, setActiveExchange] = useState('All')
  const [symbolSearch, setSymbolSearch] = useState('')
  const deferredSymbolSearch = useDeferredValue(symbolSearch)

  // Custom hooks
  const {
    dynamicFilters,
    filterLogic,
    savedFilters,
    selectedPreset,
    showSaveFilterModal,
    setDynamicFilters,
    setFilterLogic,
    setShowSaveFilterModal,
    handleReset,
    handleSaveFilter,
    handleLoadPreset,
    handleDeletePreset,
    getFilterRequest,
  } = useScreenerFilters(activeExchange)

  // Table column visibility
  const {
    visibleColumns,
    toggleColumn,
    resetToDefaults: resetColumns,
    columnsByCategory,
  } = useTableColumns()

  // Per-column sort (client-side). Default: symbol ascending.
  const [sort, setSort] = useState<{ field: ScreenerSortField; dir: SortDirection }>({
    field: 'symbol',
    dir: 'asc',
  })

  // Stable identity: isSortableColumn/isNumericSortField are pure module functions,
  // not reactive values, so an empty dep array is correct.
  const handleSort = useCallback((columnId: string) => {
    if (!isSortableColumn(columnId)) return
    setSort((prev) =>
      prev.field === columnId
        ? { field: prev.field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field: columnId, dir: isNumericSortField(columnId) ? 'desc' : 'asc' }
    )
  }, [])

  const sortedStocks = useMemo(
    () => sortStocks(stocks, sort.field, sort.dir),
    [stocks, sort]
  )

  const displayStocks = useMemo(() => {
    const q = deferredSymbolSearch.trim().toUpperCase()
    if (!q) return sortedStocks
    return sortedStocks.filter(s => s.symbol.toUpperCase().includes(q))
  }, [sortedStocks, deferredSymbolSearch])

  const {
    selectedStocks,
    handleToggleStockSelection,
    handleToggleAllSelection,
    clearSelection,
  } = useStockSelection(displayStocks)

  // Ref keeps latest getFilterRequest without destabilizing fetchStocks
  const getFilterRequestRef = useRef(getFilterRequest)
  getFilterRequestRef.current = getFilterRequest

  const fetchStocks = useCallback(async () => {
    setLoading(true)
    try {
      const filterRequest = getFilterRequestRef.current()

      const response = await api.filterStocks({
        ...filterRequest,
        exchanges: activeExchange !== 'All' ? [activeExchange] : undefined,
      })

      const converted = transformApiStocks(response.stocks)
      setStocks(converted)
      clearSelection()

      if (converted.length === 0) {
        toast.info('No stocks found matching your filters')
      }
    } catch (error) {
      handleError(error, 'Failed to fetch stocks')
      setStocks([])
    } finally {
      setLoading(false)
    }
  }, [activeExchange, clearSelection])

  // Only refetch when exchange changes (filter changes require explicit "Apply")
  useEffect(() => {
    fetchStocks()
  }, [fetchStocks])

  const handleApplyFilters = useCallback(() => {
    fetchStocks()
  }, [fetchStocks])

  const handleResetWithExchange = useCallback(() => {
    setActiveExchange('All')
    handleReset()
  }, [handleReset])


  return (
    <div className="animate-slide-in-from-bottom">
      <Header
        title="Stock Screener"
        subtitle="Filter and discover high-momentum stocks"
        actions={
          <>
            <Button
              variant="secondary"
              icon="Save"
              onClick={() => setShowSaveFilterModal(true)}
            >
              <span>Save Filter</span>
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <Card.Header
          action={
            <div className="flex gap-2 items-center [&_svg]:w-[16px] [&_svg]:h-[16px] [&_svg]:flex-shrink-0">
              {savedFilters.length > 0 && (
                <>
                  <select
                  className="flex h-10 w-[180px] rounded-md border border-[var(--border-dim)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:border-[var(--neon-cyan)] focus-visible:ring-[3px] focus-visible:ring-[var(--neon-cyan-dim)] appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2716%27%20height%3D%2716%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%2371717a%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27M6%209l6%206%206-6%27%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center] pr-10"
                  value={selectedPreset || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleLoadPreset(e.target.value)
                    } else {
                      handleReset()
                    }
                  }}
                >
                  <option value="">Saved Filters...</option>
                  {savedFilters.map(f => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
                  {selectedPreset && (
                    <button
                      className="inline-flex items-center justify-center w-10 h-10 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                      onClick={() => handleDeletePreset(selectedPreset)}
                      title="Delete saved filter"
                    >
                      <Icons.Trash2 />
                    </button>
                  )}
                </>
              )}
              <button
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors [&_svg]:w-[16px] [&_svg]:h-[16px] [&_svg]:flex-shrink-0"
                onClick={handleResetWithExchange}
              >
                <Icons.RotateCcw />
                <span>Reset</span>
              </button>
              <Button icon="Filter" onClick={handleApplyFilters} disabled={loading}>
                <span>{loading ? 'Loading...' : 'Apply'}</span>
              </Button>
            </div>
          }
        >
          <Icons.Filter />
          <span>Filter Conditions</span>
        </Card.Header>
        <Card.Body>
          <FilterBar
            filters={dynamicFilters}
            fieldOptions={SCREENER_FIELD_OPTIONS}
            operatorOptions={SCREENER_OPERATOR_OPTIONS}
            filterLogic={filterLogic}
            activeExchange={activeExchange}
            onFiltersChange={setDynamicFilters}
            onLogicChange={setFilterLogic}
            onExchangeChange={setActiveExchange}
            onReset={handleResetWithExchange}
            onSavePreset={() => setShowSaveFilterModal(true)}
          />
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          action={
            <div className="flex gap-2">
              <ColumnSelector
                columnsByCategory={columnsByCategory}
                visibleColumns={visibleColumns}
                onToggle={toggleColumn}
                onReset={resetColumns}
              />
              <button
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors [&_svg]:w-[16px] [&_svg]:h-[16px] [&_svg]:flex-shrink-0"
              >
                <Icons.GridSmall />
                <span>Export CSV</span>
              </button>
            </div>
          }
        >
          <Icons.Grid />
          <span>
            Results{' '}
            <span className="text-[var(--text-muted)] font-mono ml-2">
              {deferredSymbolSearch.trim()
                ? `${displayStocks.length} of ${sortedStocks.length} stocks`
                : `${sortedStocks.length} stocks`}
            </span>
          </span>
        </Card.Header>
        <Card.Body className="!p-0">
          <div className="px-4 py-3 border-b border-[var(--border-dim)]">
            <SearchBox
              placeholder="Search symbol in results (e.g. VCB)..."
              onSearch={setSymbolSearch}
            />
          </div>
          <ScreenerResultsTable
            sortedStocks={displayStocks}
            selectedStocks={selectedStocks}
            loading={loading}
            onToggleRow={handleToggleStockSelection}
            onToggleAll={handleToggleAllSelection}
            visibleColumns={visibleColumns}
            sortField={sort.field}
            sortDir={sort.dir}
            onSort={handleSort}
            noRowsMessage={
              deferredSymbolSearch.trim() && sortedStocks.length > 0
                ? 'No symbols match your search.'
                : undefined
            }
          />
        </Card.Body>
      </Card>

      <SaveFilterPresetDialog
        open={showSaveFilterModal}
        onOpenChange={setShowSaveFilterModal}
        onSave={handleSaveFilter}
      />

    </div>
  )
}
