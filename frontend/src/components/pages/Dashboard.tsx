import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/StatCard'
import { Icons } from '../icons/Icons'
import { SearchBox } from '../features/SearchBox'
import { ScreenerResultsTable } from '../screener/ScreenerResultsTable'
import { ColumnSelector } from '../screener/ColumnSelector'
import { useTableColumns } from '@/hooks/useTableColumns'
import { api, apiToStock } from '../../lib/api'
import type { Stock } from '../../types'

const RS_BULLISH_THRESHOLD = 80
const RS_BEARISH_THRESHOLD = 30
const TOP_STOCKS_COUNT = 10

export function Dashboard() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [cacheInfo, setCacheInfo] = useState<{
    totalStocks: number
    cachedAt: string
    bullishCount: number
    bearishCount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [symbolSearch, setSymbolSearch] = useState('')
  const deferredSymbolSearch = useDeferredValue(symbolSearch)

  // Table column visibility (shared with Screener)
  const {
    visibleColumns,
    toggleColumn,
    resetToDefaults: resetColumns,
    columnsByCategory,
  } = useTableColumns()

  // Empty set for no selection (Dashboard doesn't need selection)
  const emptySelection = useMemo(() => new Set<string>(), [])

  const fetchCacheInfo = async () => {
    try {
      const info = await api.getCacheInfo()
      if (info.cached) {
        setCacheInfo({
          totalStocks: info.total_stocks || 0,
          cachedAt: info.cached_at || '',
          bullishCount: 0,
          bearishCount: 0,
        })
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const fetchTopStocks = async () => {
    try {
      const response = await api.filterStocks({
        filters: [{ field: 'rs_52w', op: '>=', value: RS_BULLISH_THRESHOLD }],
        logic: 'and',
      })
      const converted = response.stocks.map(apiToStock)
      setStocks(converted.slice(0, TOP_STOCKS_COUNT))
    } catch (error) {
      console.error('Failed to fetch stocks:', error)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    const hasCache = await fetchCacheInfo()
    if (hasCache) {
      await fetchTopStocks()
    }
    setLoading(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.refreshStocks()
      await fetchData()
    } catch (error) {
      console.error('Failed to refresh:', error)
    }
    setRefreshing(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const stats = useMemo(() => [
    {
      label: 'Total Stocks',
      value: cacheInfo?.totalStocks?.toLocaleString() || '-',
      change: cacheInfo?.cachedAt ? `Updated ${new Date(cacheInfo.cachedAt).toLocaleTimeString()}` : 'No data',
      variant: 'default' as const,
      icon: Icons.Users,
    },
    {
      label: 'Bullish Signals',
      value: stocks.filter(s => s.rs52w >= RS_BULLISH_THRESHOLD).length.toString(),
      change: `RS 52W >= ${RS_BULLISH_THRESHOLD}`,
      variant: 'bullish' as const,
      icon: Icons.TrendUp,
    },
    {
      label: 'Bearish Signals',
      value: stocks.filter(s => s.rs52w <= RS_BEARISH_THRESHOLD).length.toString(),
      change: `RS 52W <= ${RS_BEARISH_THRESHOLD}`,
      variant: 'bearish' as const,
      icon: Icons.TrendDown,
    },
    {
      label: 'Cache Status',
      value: cacheInfo ? 'Ready' : 'Empty',
      change: cacheInfo?.cachedAt ? 'Cached' : 'Call refresh',
      variant: 'default' as const,
      icon: Icons.Database,
    },
  ], [cacheInfo, stocks])

  const displayStocks = useMemo(() => {
    const q = deferredSymbolSearch.trim().toUpperCase()
    if (!q) return stocks
    return stocks.filter(s => s.symbol.toUpperCase().includes(q))
  }, [stocks, deferredSymbolSearch])

  return (
    <div className="animate-slide-in-from-bottom">
      <Header
        title="Dashboard"
        subtitle="Vietnamese Stock Market Overview"
        actions={
          <Button icon="Refresh" onClick={handleRefresh} disabled={refreshing}>
            <span>{refreshing ? 'Refreshing...' : 'Refresh Cache'}</span>
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6 max-lg:grid-cols-2 max-md:grid-cols-1">
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      {/* Quick Search */}
      <Card className="mb-6">
        <Card.Header>
          <Icons.Search />
          <span>Quick Symbol Search</span>
        </Card.Header>
        <Card.Body>
          <SearchBox
            placeholder="Search symbol in table (e.g. VCB)..."
            onSearch={setSymbolSearch}
          />
        </Card.Body>
      </Card>

      {/* Top RS Ratings Table */}
      <Card>
        <Card.Header action={
          <div className="flex gap-2">
            <ColumnSelector
              columnsByCategory={columnsByCategory}
              visibleColumns={visibleColumns}
              onToggle={toggleColumn}
              onReset={resetColumns}
            />
            <Button variant="ghost">View All →</Button>
          </div>
        }>
          <Icons.BarChart />
          <span>Top RS Ratings</span>
        </Card.Header>
        <Card.Body className="!p-0">
          <ScreenerResultsTable
            sortedStocks={displayStocks}
            selectedStocks={emptySelection}
            loading={loading}
            onToggleRow={() => {}}
            onToggleAll={() => {}}
            visibleColumns={visibleColumns}
            showCheckbox={false}
            noRowsMessage={
              stocks.length === 0
                ? 'No stocks found. Click Refresh Cache to load data.'
                : 'No symbols match your search.'
            }
          />
        </Card.Body>
      </Card>
    </div>
  )
}
