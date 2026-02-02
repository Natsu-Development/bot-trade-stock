import { useState, useEffect } from 'react'
import { Header } from '../layout/Header'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Table } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { StatCard } from '../features/StatCard'
import { Icons } from '../icons/Icons'
import { SearchBox } from '../features/SearchBox'
import { RSRating } from '../features/RSRating'
import { formatPrice, formatChange, getBadgeVariantFromExchange } from '../../lib/utils'
import { api, apiToStock } from '../../lib/api'
import type { Stock } from '../../types'
import './Dashboard.css'

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

  const fetchCacheInfo = async () => {
    try {
      const info = await api.getCacheInfo()
      if (info.cached) {
        setCacheInfo({
          totalStocks: info.total_stocks || 0,
          cachedAt: info.cached_at || '',
          bullishCount: 0, // Will be calculated
          bearishCount: 0, // Will be calculated
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
        filters: [{ field: 'rs_52w', op: '>=', value: 80 }],
        logic: 'and',
      })
      const converted = response.stocks.map(apiToStock)
      setStocks(converted.slice(0, 10)) // Top 10
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

  const stats = [
    {
      label: 'Total Stocks',
      value: cacheInfo?.totalStocks?.toLocaleString() || '-',
      change: cacheInfo?.cachedAt ? `Updated ${new Date(cacheInfo.cachedAt).toLocaleTimeString()}` : 'No data',
      variant: 'default' as const,
      icon: Icons.Users,
    },
    {
      label: 'Bullish Signals',
      value: stocks.filter(s => s.rs52w >= 80).length.toString(),
      change: 'RS 52W ≥ 80',
      variant: 'bullish' as const,
      icon: Icons.TrendUp,
    },
    {
      label: 'Bearish Signals',
      value: stocks.filter(s => s.rs52w <= 30).length.toString(),
      change: 'RS 52W ≤ 30',
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
  ]

  return (
    <div className="page active">
      <Header
        title="Dashboard"
        subtitle="Vietnamese Stock Market Overview"
        actions={
          <Button
            icon="Refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Cache'}
          </Button>
        }
      />

      <div className="stats-grid">
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      <Card className="mb-6">
        <Card.Header>
          <Icons.Search />
          Quick Symbol Search
        </Card.Header>
        <Card.Body>
          <SearchBox />
        </Card.Body>
      </Card>

      <Card>
        <Card.Header action={<button className="btn btn-ghost">View All →</button>}>
          <Icons.BarChart />
          Top RS Ratings
        </Card.Header>
        <Card.Body style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
              Loading...
            </div>
          ) : stocks.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
              No stocks found. Click Refresh Cache to load data.
            </div>
          ) : (
            <Table
              headers={['Symbol', 'Exchange', 'RS 52W', 'Volume vs SMA', 'Vol/SMA', 'Price', 'Change']}
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
                  <td><RSRating value={stock.rs52w} /></td>
                  <td className={parseFloat(stock.volume || '') >= 0 ? 'text-bull' : 'text-bear'}>
                    {stock.volume}
                  </td>
                  <td className="text-muted">
                    {stock.currentVolume?.toLocaleString()} / {stock.volumeSma20?.toLocaleString()}
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
