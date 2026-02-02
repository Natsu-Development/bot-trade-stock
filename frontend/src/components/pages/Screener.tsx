import { useState, useEffect } from 'react'
import { Header } from '../layout/Header'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Table } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { Chip } from '../ui/Chip'
import { Dialog } from '../ui/Dialog'
import { Icons } from '../icons/Icons'
import { formatPrice, formatChange, getBadgeVariantFromExchange } from '../../lib/utils'
import { api, apiToStock, getConfigId, type ScreenerFilterPreset } from '../../lib/api'
import { toast } from '../ui/Toast'
import type { Stock, DynamicFilter, FilterField, FilterOperator, FilterFieldOption, FilterOperatorOption } from '../../types'
import './Screener.css'

const exchanges = ['All', 'HOSE', 'HNX', 'UPCOM']

// Filter field options
const filterFieldOptions: FilterFieldOption[] = [
  { value: 'rs_1m', label: 'RS 1M', description: '1-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_3m', label: 'RS 3M', description: '3-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_6m', label: 'RS 6M', description: '6-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_9m', label: 'RS 9M', description: '9-Month Relative Strength', category: 'RS Rating' },
  { value: 'rs_52w', label: 'RS 52W', description: '52-Week Relative Strength', category: 'RS Rating' },
  { value: 'volume_vs_sma', label: 'Vol vs SMA', description: 'Volume vs SMA20 (%)', category: 'Volume' },
  { value: 'current_volume', label: 'Current Vol', description: 'Current Volume', category: 'Volume' },
  { value: 'volume_sma20', label: 'Vol SMA20', description: '20-day SMA Volume', category: 'Volume' },
]

// Filter operator options
const filterOperatorOptions: FilterOperatorOption[] = [
  { value: '>=', label: 'Greater or equal (≥)' },
  { value: '<=', label: 'Less or equal (≤)' },
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '=', label: 'Equal (=)' },
]

// Default filters for new users
const getDefaultFilters = (): DynamicFilter[] => [
  { id: '1', field: 'rs_52w', operator: '>=', value: 70 },
]

// Generate unique ID for new filter
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

export function Screener() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [activeExchange, setActiveExchange] = useState('All')

  // Dynamic filter state
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>(getDefaultFilters)
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('and')

  // Saved filter presets
  const [savedFilters, setSavedFilters] = useState<ScreenerFilterPreset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')

  // Stock selection for watchlist
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())
  const [showWatchlistModal, setShowWatchlistModal] = useState(false)

  // Removed toast state in favor of toast function

  // Load saved filters from config
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
      // Build filters from dynamic filter state
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
      // Clear selection when results change
      setSelectedStocks(new Set())
    } catch (error) {
      console.error('Failed to fetch stocks:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStocks()
    // Only run on initial mount or exchange change
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Dynamic filter handlers
  const handleAddFilter = () => {
    const newFilter: DynamicFilter = {
      id: generateId(),
      field: 'rs_52w',
      operator: '>=',
      value: '',
    }
    setDynamicFilters([...dynamicFilters, newFilter])
  }

  const handleRemoveFilter = (id: string) => {
    setDynamicFilters(dynamicFilters.filter(f => f.id !== id))
  }

  const handleUpdateFilter = (id: string, updates: Partial<DynamicFilter>) => {
    setDynamicFilters(dynamicFilters.map(f =>
      f.id === id ? { ...f, ...updates } : f
    ))
  }

  // Get field option helper
  const getFieldOption = (field: FilterField) => {
    return filterFieldOptions.find(o => o.value === field)
  }

  // Check if all filters have valid values
  const hasValidFilters = dynamicFilters.some(f =>
    f.value !== '' && !isNaN(Number(f.value))
  )

  // Save filter preset (update if exists, otherwise create new)
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

      // Check if filter with this name already exists
      const existingIndex = (config.screener_filters || []).findIndex(f => f.name === newFilterName)

      let updatedFilters: ScreenerFilterPreset[]
      if (existingIndex >= 0) {
        // Update existing filter
        updatedFilters = [...(config.screener_filters || [])]
        updatedFilters[existingIndex] = newPreset
        toast.success('Filter updated successfully')
      } else {
        // Add new filter
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

  // Load saved filter preset
  const handleLoadPreset = (presetName: string) => {
    const preset = savedFilters.find(f => f.name === presetName)
    if (!preset) return

    setSelectedPreset(presetName)

    // Convert preset filters to DynamicFilter format
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

  // Delete saved filter preset
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

  // Stock selection handlers
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
    <div className="page active">
      <Header
        title="Stock Screener"
        subtitle="Filter and discover high-momentum stocks"
        actions={
          <>
            <Button
              variant="secondary"
              icon="Save"
              onClick={() => setShowSaveFilterModal(true)}
              disabled={!hasValidFilters}
            >
              Save Filter
            </Button>
            <Button icon="Filter" onClick={handleApplyFilters} disabled={loading}>
              {loading ? 'Loading...' : 'Apply Filters'}
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <Card.Header
          action={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Saved Filters Dropdown */}
              {savedFilters.length > 0 && (
                <>
                  <select
                    className="form-input form-select"
                    value={selectedPreset || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleLoadPreset(e.target.value)
                      } else {
                        setSelectedPreset(null)
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  >
                    <option value="">Saved Filters...</option>
                    {savedFilters.map(f => (
                      <option key={f.name} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                  {selectedPreset && (
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => handleDeletePreset(selectedPreset)}
                      title="Delete saved filter"
                    >
                      <Icons.Trash2 />
                    </button>
                  )}
                </>
              )}
              <button className="btn btn-ghost" onClick={handleReset}>
                <Icons.RotateCcw />
                Reset All
              </button>
            </div>
          }
        >
          <Icons.Filter />
          Filter Conditions
        </Card.Header>
        <Card.Body>
          {/* Exchange Filter */}
          <div className="form-group mb-4">
            <label className="form-label">Exchange</label>
            <div className="filter-chips">
              {exchanges.map((exchange) => (
                <Chip
                  key={exchange}
                  active={activeExchange === exchange}
                  onClick={() => setActiveExchange(exchange)}
                >
                  {exchange}
                </Chip>
              ))}
            </div>
          </div>

          {/* Dynamic Filter Builder */}
          <div className="filter-builder">
            <div className="filter-builder-header">
              <label className="form-label mb-0">Dynamic Filters</label>
              <Button
                variant="secondary"
                icon="Plus"
                onClick={handleAddFilter}
                className="btn-sm"
              >
                Add Filter
              </Button>
            </div>

            {/* Filter Logic Selector */}
            <div className="filter-logic-bar">
              <span className="filter-logic-label">Match</span>
              <select
                className="form-input form-select filter-logic-select"
                value={filterLogic}
                onChange={(e) => setFilterLogic(e.target.value as 'and' | 'or')}
              >
                <option value="and">ALL conditions (AND)</option>
                <option value="or">ANY condition (OR)</option>
              </select>
            </div>

            {/* Filter Rows */}
            <div className="filter-rows">
              {dynamicFilters.length === 0 ? (
                <div className="filter-empty">
                  <Icons.Filter />
                  <p>No filters added. Click "Add Filter" to create conditions.</p>
                </div>
              ) : (
                dynamicFilters.map((filter, index) => {
                  const fieldOption = getFieldOption(filter.field)
                  return (
                    <div key={filter.id} className="filter-row">
                      <div className="filter-row-number">
                        <span>{index + 1}</span>
                      </div>

                      {/* Field Selector */}
                      <div className="filter-field">
                        <label className="filter-label">Field</label>
                        <select
                          className="form-input form-select"
                          value={filter.field}
                          onChange={(e) => handleUpdateFilter(filter.id, { field: e.target.value as FilterField })}
                        >
                          {filterFieldOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label} - {option.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Operator Selector */}
                      <div className="filter-operator">
                        <label className="filter-label">Operator</label>
                        <select
                          className="form-input form-select"
                          value={filter.operator}
                          onChange={(e) => handleUpdateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                        >
                          {filterOperatorOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Value Input */}
                      <div className="filter-value">
                        <label className="filter-label">Value</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder={fieldOption?.value === 'volume_vs_sma' ? 'e.g., 50' : '1-99'}
                          value={filter.value}
                          onChange={(e) => handleUpdateFilter(filter.id, { value: parseFloat(e.target.value) || '' })}
                        />
                      </div>

                      {/* Remove Button */}
                      <button
                        className="btn btn-ghost btn-icon filter-remove"
                        onClick={() => handleRemoveFilter(filter.id)}
                        title="Remove filter"
                      >
                        <Icons.X />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Filter Summary */}
            {dynamicFilters.length > 0 && hasValidFilters && (
              <div className="filter-summary">
                <span className="filter-summary-count">
                  {dynamicFilters.filter(f => f.value !== '').length} active filter(s)
                </span>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          action={
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedStocks.size > 0 && (
                <Button
                  variant="primary"
                  icon="Plus"
                  onClick={handleAddSelectedToWatchlist}
                  style={{ fontSize: '13px', padding: '6px 12px' }}
                >
                  Add Selected ({selectedStocks.size})
                </Button>
              )}
              <Button
                variant="secondary"
                icon="List"
                onClick={handleAddAllToWatchlist}
                disabled={stocks.length === 0}
                style={{ fontSize: '13px', padding: '6px 12px' }}
              >
                Add All
              </Button>
              <button className="btn btn-ghost">Export CSV</button>
            </div>
          }
        >
          <Icons.Grid />
          Results <span className="text-muted font-mono" style={{ marginLeft: '8px' }}>{stocks.length} stocks</span>
        </Card.Header>
        <Card.Body style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
              Loading...
            </div>
          ) : stocks.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
              No stocks found matching your filters.
            </div>
          ) : (
            <Table
              headers={[
                <label key="select" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedStocks.size === stocks.length && stocks.length > 0}
                    onChange={handleToggleAllSelection}
                  />
                </label>,
                'Symbol',
                'Exchange',
                'RS 1M',
                'RS 3M',
                'RS 6M',
                'RS 9M',
                'RS 52W',
                'Vol/SMA',
                'Price',
                'Change %'
              ]}
            >
              {stocks.map((stock) => (
                <tr key={stock.symbol}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedStocks.has(stock.symbol)}
                      onChange={() => handleToggleStockSelection(stock.symbol)}
                    />
                  </td>
                  <td>
                    <div className="symbol-cell">
                      <div className="symbol-avatar">{stock.symbol}</div>
                      <span className="symbol-name">{stock.name}</span>
                    </div>
                  </td>
                  <td><Badge variant={getBadgeVariantFromExchange(stock.exchange)}>{stock.exchange}</Badge></td>
                  <td className={stock.rs1m !== undefined && stock.rs1m >= 80 ? 'text-bull' : ''}>{stock.rs1m ?? '-'}</td>
                  <td className={stock.rs3m !== undefined && stock.rs3m >= 80 ? 'text-bull' : ''}>{stock.rs3m ?? '-'}</td>
                  <td className={stock.rs6m !== undefined && stock.rs6m >= 80 ? 'text-bull' : ''}>{stock.rs6m ?? '-'}</td>
                  <td className={stock.rs9m !== undefined && stock.rs9m >= 80 ? 'text-bull' : ''}>{stock.rs9m ?? '-'}</td>
                  <td className={stock.rs52w >= 80 ? 'text-bull' : ''}>{stock.rs52w}</td>
                  <td className={parseFloat(stock.volume || '') >= 0 ? 'text-cyan' : 'text-muted'}>
                    {stock.volume}
                  </td>
                  <td>{formatPrice(stock.price)}</td>
                  <td className={stock.change >= 0 ? 'text-bull' : 'text-bear'}>
                    {formatChange(stock.change)}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Save Filter Modal */}
      <Dialog isOpen={showSaveFilterModal} onClose={() => setShowSaveFilterModal(false)}>
        <Dialog.Header icon={<Icons.Save />}>
          Save Filter Preset
          <Dialog.CloseButton onClick={() => setShowSaveFilterModal(false)} />
        </Dialog.Header>
        <Dialog.Body>
          <div className="form-group">
            <label className="form-label">Filter Name</label>
            <input
              type="text"
              className="form-input"
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
            <p className="form-hint">
              This will save your current filter conditions and logic for quick access later.
            </p>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="secondary" onClick={() => setShowSaveFilterModal(false)}>
            Cancel
          </Button>
          <Button icon="Save" onClick={handleSaveFilter}>
            Save Filter
          </Button>
        </Dialog.Footer>
      </Dialog>

      {/* Watchlist Modal */}
      <Dialog isOpen={showWatchlistModal} onClose={() => setShowWatchlistModal(false)}>
        <Dialog.Header icon={<Icons.List />}>
          Add to Watchlist
          <Dialog.CloseButton onClick={() => setShowWatchlistModal(false)} />
        </Dialog.Header>
        <Dialog.Body>
          <p style={{ marginBottom: '16px' }}>
            Add {selectedStocks.size} stock(s) to your watchlist:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              className="watchlist-option-btn"
              onClick={() => handleConfirmWatchlist('bullish')}
            >
              <div className="watchlist-option-icon bullish">
                <Icons.TrendUp />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="watchlist-option-title bullish">Bullish Watchlist</div>
                <div className="watchlist-option-desc">
                  For entry signals - stocks you want to buy
                </div>
              </div>
            </button>
            <button
              className="watchlist-option-btn"
              onClick={() => handleConfirmWatchlist('bearish')}
            >
              <div className="watchlist-option-icon bearish">
                <Icons.TrendDown />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="watchlist-option-title bearish">Bearish Watchlist</div>
                <div className="watchlist-option-desc">
                  For exit signals - stocks you currently hold
                </div>
              </div>
            </button>
          </div>
          {selectedStocks.size <= 5 && (
            <div className="selected-stocks-preview">
              <div className="selected-stocks-label">Selected stocks:</div>
              <div className="selected-stocks-tags">
                {Array.from(selectedStocks).map(s => (
                  <span key={s} className="stock-tag">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="secondary" onClick={() => setShowWatchlistModal(false)}>
            Cancel
          </Button>
        </Dialog.Footer>
      </Dialog>

      <style>{`
        .form-hint {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--text-muted);
        }

        .watchlist-option-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          padding: 16px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-dim);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .watchlist-option-btn:hover {
          border-color: var(--border-glow);
          background: var(--bg-hover);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .watchlist-option-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .watchlist-option-icon.bullish {
          background: var(--neon-bull-dim);
          color: var(--neon-bull);
        }

        .watchlist-option-icon.bearish {
          background: var(--neon-bear-dim);
          color: var(--neon-bear);
        }

        .watchlist-option-icon svg {
          width: 24px;
          height: 24px;
        }

        .watchlist-option-title {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .watchlist-option-title.bullish {
          color: var(--neon-bull);
        }

        .watchlist-option-title.bearish {
          color: var(--neon-bear);
        }

        .watchlist-option-desc {
          font-size: 13px;
          color: var(--text-muted);
        }

        .selected-stocks-preview {
          margin-top: 16px;
          padding: 12px;
          background: var(--bg-elevated);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-dim);
        }

        .selected-stocks-label {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .selected-stocks-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .stock-tag {
          padding: 4px 10px;
          background: var(--bg-hover);
          border: 1px solid var(--border-dim);
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-family: var(--font-mono);
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}
