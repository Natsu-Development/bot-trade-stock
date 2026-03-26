import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogIcon } from '@/components/ui/dialog'
import { Icons } from '../icons/Icons'
import { api, getConfigId } from '../../lib/api'
import { toast } from '../ui/Toast'
import { handleError } from '../../lib/errors'
import { transformApiStocks } from '../../lib/screenerUtils'
import { FilterBar } from '../screener/FilterBar'
import { SaveFilterPresetDialog } from '../screener/SaveFilterPresetDialog'
import { ScreenerResultsTable } from '../screener/ScreenerResultsTable'
import { useScreenerFilters } from '../../hooks/screener/useScreenerFilters'
import { useStockSelection } from '../../hooks/screener/useStockSelection'
import type { Stock, FilterFieldOption, FilterOperatorOption } from '../../types'

const filterFieldOptions: FilterFieldOption[] = [
  { value: 'rs_1m', label: 'RS 1M', shortLabel: 'RS 1M', description: '1-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_3m', label: 'RS 3M', shortLabel: 'RS 3M', description: '3-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_6m', label: 'RS 6M', shortLabel: 'RS 6M', description: '6-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_9m', label: 'RS 9M', shortLabel: 'RS 9M', description: '9-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_52w', label: 'RS 52W', shortLabel: 'RS 52W', description: '52-Week Relative Strength', category: 'RS Rating' },
  { value: 'volume_vs_sma', label: 'Vol vs SMA', shortLabel: 'Vol vs SMA', description: 'Volume vs SMA20 (%)', category: 'Volume' },
  { value: 'current_volume', label: 'Current Vol', shortLabel: 'Cur Vol', description: 'Current Volume', category: 'Volume' },
  { value: 'volume_sma20', label: 'Vol SMA20', shortLabel: 'Vol SMA20', description: '20-day SMA Volume', category: 'Volume' },
]

const filterOperatorOptions: FilterOperatorOption[] = [
  { value: '>=', label: 'Greater or equal (≥)' },
  { value: '<=', label: 'Less or equal (≤)' },
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '=', label: 'Equal (=)' },
]

export function Screener() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [activeExchange, setActiveExchange] = useState('All')

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

  const {
    selectedStocks,
    showWatchlistModal,
    setShowWatchlistModal,
    handleToggleStockSelection,
    handleToggleAllSelection,
    clearSelection,
    selectAllStocks,
  } = useStockSelection(stocks)

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

  const handleAddSelectedToWatchlistWithError = useCallback(() => {
    const hasSelection = selectedStocks.size > 0
    if (!hasSelection) {
      toast.error('Please select at least one stock')
      return
    }
    setShowWatchlistModal(true)
  }, [selectedStocks])

  const handleAddAllToWatchlistWithError = useCallback(() => {
    if (stocks.length === 0) {
      toast.error('No stocks to add')
      return
    }
    selectAllStocks()
    setShowWatchlistModal(true)
  }, [stocks, selectAllStocks, setShowWatchlistModal])

  const handleConfirmWatchlist = useCallback(async (listType: 'bullish' | 'bearish') => {
    try {
      const configId = getConfigId()
      const symbols = Array.from(selectedStocks)

      await api.addSymbolsToWatchlist(configId, listType, symbols)

      clearSelection()
      setShowWatchlistModal(false)

      const listName = listType === 'bullish' ? 'Bullish' : 'Bearish'
      toast.success(`Added ${symbols.length} stocks to ${listName} watchlist`)
    } catch (error) {
      console.error('Failed to add to watchlist:', error)
      toast.error('Failed to add stocks to watchlist')
    }
  }, [selectedStocks, clearSelection, setShowWatchlistModal])

  // Memoize sorted stocks for stable rendering
  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => a.symbol.localeCompare(b.symbol))
  }, [stocks])

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
            fieldOptions={filterFieldOptions}
            operatorOptions={filterOperatorOptions}
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
              {selectedStocks.size > 0 && (
                <Button
                  variant="primary"
                  icon="Plus"
                  onClick={handleAddSelectedToWatchlistWithError}
                  className="text-xs px-3 py-1.5 h-8"
                >
                  <span>Add Selected ({selectedStocks.size})</span>
                </Button>
              )}
              <Button
                variant="secondary"
                icon="List"
                onClick={handleAddAllToWatchlistWithError}
                disabled={stocks.length === 0}
                className="text-xs px-3 py-1.5 h-8"
              >
                <span>Add All</span>
              </Button>
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
          <span>Results <span className="text-[var(--text-muted)] font-mono ml-2">{stocks.length} stocks</span></span>
        </Card.Header>
        <Card.Body className="!p-0">
          <ScreenerResultsTable
            sortedStocks={sortedStocks}
            selectedStocks={selectedStocks}
            loading={loading}
            onToggleRow={handleToggleStockSelection}
            onToggleAll={handleToggleAllSelection}
          />
        </Card.Body>
      </Card>

      <SaveFilterPresetDialog
        open={showSaveFilterModal}
        onOpenChange={setShowSaveFilterModal}
        onSave={handleSaveFilter}
      />

      <Dialog open={showWatchlistModal} onOpenChange={(open) => setShowWatchlistModal(open)}>
        <DialogContent size="md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogIcon><Icons.List /></DialogIcon>
            <DialogTitle>Add to Watchlist</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="mb-4">
              Add {selectedStocks.size} stock(s) to your watchlist:
            </p>
            <div className="flex flex-col gap-3">
              <button
                className="flex items-center gap-4 w-full p-4 bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-md cursor-pointer transition-all duration-150 hover:border-[var(--border-glow)] hover:bg-[var(--bg-hover)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                onClick={() => handleConfirmWatchlist('bullish')}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[var(--neon-bull-dim)] text-[var(--neon-bull)] flex-shrink-0">
                  <Icons.TrendUp />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold mb-1 text-[var(--neon-bull)]">Bullish Watchlist</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    For entry signals - stocks you want to buy
                  </div>
                </div>
              </button>
              <button
                className="flex items-center gap-4 w-full p-4 bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-md cursor-pointer transition-all duration-150 hover:border-[var(--border-glow)] hover:bg-[var(--bg-hover)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                onClick={() => handleConfirmWatchlist('bearish')}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[var(--neon-bear-dim)] text-[var(--neon-bear)] flex-shrink-0">
                  <Icons.TrendDown />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold mb-1 text-[var(--neon-bear)]">Bearish Watchlist</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    For exit signals - stocks you currently hold
                  </div>
                </div>
              </button>
            </div>
            {selectedStocks.size <= 5 && (
              <div className="mt-4 p-3 bg-[var(--bg-elevated)] rounded-md border border-[var(--border-dim)]">
                <div className="text-xs text-[var(--text-muted)] mb-2">Selected stocks:</div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(selectedStocks).map(s => (
                    <span key={s} className="px-2.5 py-1 bg-[var(--bg-hover)] border border-[var(--border-dim)] rounded text-xs font-mono text-[var(--text-secondary)]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowWatchlistModal(false)}>
              <span>Cancel</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
