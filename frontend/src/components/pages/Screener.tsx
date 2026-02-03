import { useState, useEffect } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogIcon } from '@/components/ui/dialog'
import { Icons } from '../icons/Icons'
import { formatPrice, formatChange, getBadgeVariantFromExchange } from '../../lib/utils'
import { api, apiToStock, getConfigId, type ScreenerFilterPreset } from '../../lib/api'
import { toast } from '../ui/Toast'
import { FilterBar } from '../screener/FilterBar'
import type { Stock, DynamicFilter, FilterField, FilterOperator, FilterFieldOption, FilterOperatorOption } from '../../types'

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

const getDefaultFilters = (): DynamicFilter[] => [
  { id: '1', field: 'rs_52w', operator: '>=', value: 70 },
]

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

export function Screener() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [activeExchange, setActiveExchange] = useState('All')

  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>(getDefaultFilters)
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('and')

  const [savedFilters, setSavedFilters] = useState<ScreenerFilterPreset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')

  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())
  const [showWatchlistModal, setShowWatchlistModal] = useState(false)

  useEffect(() => {
    loadSavedFilters()
  }, [])

  const loadSavedFilters = async () => {
    try {
      const configId = getConfigId()
      const config = await api.getConfig(configId)
      setSavedFilters(config.screener_filters || [])
    } catch (error) {
      console.error('Failed to load saved filters:', error)
    }
  }

  const fetchStocks = async () => {
    setLoading(true)
    try {
      const filters = dynamicFilters
        .filter(f => f.value !== '' && !isNaN(Number(f.value)))
        .map(f => ({
          field: f.field,
          op: f.operator,
          value: Number(f.value),
        }))

      const response = await api.filterStocks({
        filters,
        logic: filterLogic,
        exchanges: activeExchange !== 'All' ? [activeExchange] : undefined,
      })

      const converted = response.stocks.map(apiToStock)
      setStocks(converted)
      setSelectedStocks(new Set())
    } catch (error) {
      console.error('Failed to fetch stocks:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStocks()
  }, [activeExchange])

  const handleApplyFilters = () => {
    fetchStocks()
  }

  const handleReset = () => {
    setDynamicFilters(getDefaultFilters())
    setFilterLogic('and')
    setActiveExchange('All')
    setSelectedPreset(null)
  }

  const handleSaveFilter = async () => {
    if (!newFilterName.trim()) {
      toast.error('Please enter a filter name')
      return
    }

    try {
      const configId = getConfigId()
      const config = await api.getConfig(configId)

      const newPreset: ScreenerFilterPreset = {
        name: newFilterName,
        filters: dynamicFilters
          .filter(f => f.value !== '' && !isNaN(Number(f.value)))
          .map(f => ({
            field: f.field,
            op: f.operator,
            value: Number(f.value),
          })),
        logic: filterLogic,
        exchanges: activeExchange !== 'All' ? [activeExchange] : undefined,
        created_at: new Date().toISOString(),
      }

      const existingIndex = (config.screener_filters || []).findIndex(f => f.name === newFilterName)

      let updatedFilters: ScreenerFilterPreset[]
      if (existingIndex >= 0) {
        updatedFilters = [...(config.screener_filters || [])]
        updatedFilters[existingIndex] = newPreset
        toast.success('Filter updated successfully')
      } else {
        updatedFilters = [...(config.screener_filters || []), newPreset]
        toast.success('Filter saved successfully')
      }

      await api.updateConfig(configId, {
        screener_filters: updatedFilters,
      })

      setSavedFilters(updatedFilters)
      setNewFilterName('')
      setShowSaveFilterModal(false)
    } catch (error) {
      console.error('Failed to save filter:', error)
      toast.error('Failed to save filter')
    }
  }

  const handleLoadPreset = (presetName: string) => {
    const preset = savedFilters.find(f => f.name === presetName)
    if (!preset) return

    setSelectedPreset(presetName)

    const loadedFilters: DynamicFilter[] = preset.filters.map((f, index) => ({
      id: generateId() + index,
      field: f.field as FilterField,
      operator: f.op as FilterOperator,
      value: f.value,
    }))

    setDynamicFilters(loadedFilters.length > 0 ? loadedFilters : getDefaultFilters())
    setFilterLogic(preset.logic)
    if (preset.exchanges && preset.exchanges.length > 0) {
      setActiveExchange(preset.exchanges[0])
    } else {
      setActiveExchange('All')
    }
  }

  const handleDeletePreset = async (presetName: string) => {
    try {
      const configId = getConfigId()
      const config = await api.getConfig(configId)

      const updatedFilters = (config.screener_filters || []).filter(f => f.name !== presetName)

      await api.updateConfig(configId, {
        screener_filters: updatedFilters,
      })

      setSavedFilters(updatedFilters)
      if (selectedPreset === presetName) {
        setSelectedPreset(null)
      }
      toast.success('Filter deleted')
    } catch (error) {
      console.error('Failed to delete filter:', error)
      toast.error('Failed to delete filter')
    }
  }

  const handleToggleStockSelection = (symbol: string) => {
    const newSelection = new Set(selectedStocks)
    if (newSelection.has(symbol)) {
      newSelection.delete(symbol)
    } else {
      newSelection.add(symbol)
    }
    setSelectedStocks(newSelection)
  }

  const handleToggleAllSelection = () => {
    if (selectedStocks.size === stocks.length) {
      setSelectedStocks(new Set())
    } else {
      setSelectedStocks(new Set(stocks.map(s => s.symbol)))
    }
  }

  const handleAddSelectedToWatchlist = () => {
    if (selectedStocks.size === 0) {
      toast.error('Please select at least one stock')
      return
    }
    setShowWatchlistModal(true)
  }

  const handleAddAllToWatchlist = () => {
    if (stocks.length === 0) {
      toast.error('No stocks to add')
      return
    }
    setSelectedStocks(new Set(stocks.map(s => s.symbol)))
    setShowWatchlistModal(true)
  }

  const handleConfirmWatchlist = async (listType: 'bullish' | 'bearish') => {
    try {
      const configId = getConfigId()
      const symbols = Array.from(selectedStocks)

      await api.addSymbolsToWatchlist(configId, listType, symbols)

      setSelectedStocks(new Set())
      setShowWatchlistModal(false)

      const listName = listType === 'bullish' ? 'Bullish' : 'Bearish'
      toast.success(`Added ${symbols.length} stocks to ${listName} watchlist`)
    } catch (error) {
      console.error('Failed to add to watchlist:', error)
      toast.error('Failed to add stocks to watchlist')
    }
  }

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
                      setSelectedPreset(null)
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
                onClick={handleReset}
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
            onReset={handleReset}
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
                  onClick={handleAddSelectedToWatchlist}
                  className="text-xs px-3 py-1.5 h-8"
                >
                  <span>Add Selected ({selectedStocks.size})</span>
                </Button>
              )}
              <Button
                variant="secondary"
                icon="List"
                onClick={handleAddAllToWatchlist}
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
          {loading ? (
            <div className="p-10 text-center text-[var(--text-muted)]">
              Loading...
            </div>
          ) : stocks.length === 0 ? (
            <div className="p-10 text-center text-[var(--text-muted)]">
              No stocks found matching your filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStocks.size === stocks.length && stocks.length > 0}
                        onChange={handleToggleAllSelection}
                      />
                    </label>
                  </TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Exchange</TableHead>
                  <TableHead>RS 1M</TableHead>
                  <TableHead>RS 3M</TableHead>
                  <TableHead>RS 52W</TableHead>
                  <TableHead>Vol/SMA</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Change %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((stock, index) => (
                  <TableRow
                    key={stock.symbol}
                    selected={selectedStocks.has(stock.symbol)}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedStocks.has(stock.symbol)}
                        onChange={() => handleToggleStockSelection(stock.symbol)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-hover)] flex items-center justify-center text-[10px] font-semibold text-[var(--neon-cyan)] border border-[var(--border-glow)]">
                          {stock.symbol}
                        </div>
                        <span className="font-semibold text-[var(--text-primary)] font-display">
                          {stock.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariantFromExchange(stock.exchange)}>
                        {stock.exchange}
                      </Badge>
                    </TableCell>
                    <TableCell className={stock.rs1m !== undefined && stock.rs1m >= 80 ? 'text-[var(--neon-bull)]' : ''}>
                      {stock.rs1m ?? '-'}
                    </TableCell>
                    <TableCell className={stock.rs3m !== undefined && stock.rs3m >= 80 ? 'text-[var(--neon-bull)]' : ''}>
                      {stock.rs3m ?? '-'}
                    </TableCell>
                    <TableCell className={stock.rs52w >= 80 ? 'text-[var(--neon-bull)]' : ''}>
                      {stock.rs52w}
                    </TableCell>
                    <TableCell className={parseFloat(stock.volume || '') >= 0 ? 'text-[var(--neon-cyan)]' : 'text-[var(--text-muted)]'}>
                      {stock.volume}
                    </TableCell>
                    <TableCell>{formatPrice(stock.price)}</TableCell>
                    <TableCell className={stock.change >= 0 ? 'text-[var(--neon-bull)]' : 'text-[var(--neon-bear)]'}>
                      {formatChange(stock.change)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Dialog open={showSaveFilterModal} onOpenChange={(open) => setShowSaveFilterModal(open)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogIcon><Icons.Save /></DialogIcon>
            Save Filter Preset
          </DialogHeader>
          <DialogBody>
            <div className="mb-4">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                Filter Name
              </label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-[var(--border-dim)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--text-primary)] font-mono shadow-sm transition-colors placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:border-[var(--neon-cyan)] focus-visible:ring-[3px] focus-visible:ring-[var(--neon-cyan-dim)]"
                placeholder="e.g., High RS Stocks (80+)"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveFilter()
                  }
                }}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                This will save your current filter conditions and logic for quick access later.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowSaveFilterModal(false)}>
              <span>Cancel</span>
            </Button>
            <Button icon="Save" onClick={handleSaveFilter}>
              <span>Save Filter</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWatchlistModal} onOpenChange={(open) => setShowWatchlistModal(open)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogIcon><Icons.List /></DialogIcon>
            Add to Watchlist
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
