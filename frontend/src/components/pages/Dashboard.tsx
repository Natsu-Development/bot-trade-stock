import { useState, useEffect } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '../features/StatCard'
import { Icons } from '../icons/Icons'
import { SearchBox } from '../features/SearchBox'
import { RSRating } from '../features/RSRating'
import { formatPrice, formatChange, getBadgeVariantFromExchange } from '../../lib/utils'
import { api, apiToStock } from '../../lib/api'
import type { Stock } from '../../types'

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
        filters: [{ field: 'rs_52w', op: '>=', value: 80 }],
        logic: 'and',
      })
      const converted = response.stocks.map(apiToStock)
      setStocks(converted.slice(0, 10))
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
      change: 'RS 52W >= 80',
      variant: 'bullish' as const,
      icon: Icons.TrendUp,
    },
    {
      label: 'Bearish Signals',
      value: stocks.filter(s => s.rs52w <= 30).length.toString(),
      change: 'RS 52W <= 30',
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
          <SearchBox />
        </Card.Body>
      </Card>

      {/* Top RS Ratings Table */}
      <Card>
        <Card.Header action={<Button variant="ghost">View All →</Button>}>
          <Icons.BarChart />
          <span>Top RS Ratings</span>
        </Card.Header>
        <Card.Body className="!p-0">
          {loading ? (
            <div className="p-10 text-center text-[var(--text-muted)]">
              Loading...
            </div>
          ) : stocks.length === 0 ? (
            <div className="p-10 text-center text-[var(--text-muted)]">
              No stocks found. Click Refresh Cache to load data.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Exchange</TableHead>
                  <TableHead>RS 52W</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((stock, index) => (
                  <TableRow
                    key={stock.symbol}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
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
                    <TableCell>
                      <RSRating value={stock.rs52w} />
                    </TableCell>
                    <TableCell>{formatPrice(stock.price)}</TableCell>
                    <TableCell className={stock.change >= 0 ? 'text-[var(--neon-bull)]' : 'text-[var(--neon-bear)]'}>
                      {formatChange(stock.change)}
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">
                      {stock.currentVolume ? `${(stock.currentVolume / 1000000).toFixed(1)}M` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
