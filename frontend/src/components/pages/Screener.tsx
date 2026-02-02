import { useState, useEffect } from 'react'
import { Header } from '../layout/Header'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Table } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { Chip } from '../ui/Chip'
import { Icons } from '../icons/Icons'
import { formatPrice, formatChange, getBadgeVariantFromExchange } from '../../lib/utils'
import { api, apiToStock } from '../../lib/api'
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

// Generate unique ID for new filters
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

export function Screener() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [activeExchange, setActiveExchange] = useState('All')

  // Dynamic filter state
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>(getDefaultFilters)
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('and')

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

  return (
    <div className="page active">
      <Header
        title="Stock Screener"
        subtitle="Filter and discover high-momentum stocks"
        actions={
          <>
            <Button variant="secondary" icon="Save">Save Filter</Button>
            <Button icon="Filter" onClick={handleApplyFilters} disabled={loading}>
              {loading ? 'Loading...' : 'Apply Filters'}
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <Card.Header
          action={
            <button className="btn btn-ghost" onClick={handleReset}>
              <Icons.RotateCcw />
              Reset All
            </button>
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
          action={<button className="btn btn-ghost">Export CSV</button>}
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
              headers={['Symbol', 'Exchange', 'RS 1M', 'RS 3M', 'RS 6M', 'RS 9M', 'RS 52W', 'Vol/SMA', 'Price', 'Change %']}
            >
              {stocks.map((stock) => (
                <tr key={stock.symbol}>
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
    </div>
  )
}
