import { memo } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatPrice, getBadgeVariantFromExchange } from '@/lib/utils'
import type { Stock } from '@/types'

/** Signal badge colors - compact pill style */
const SIGNAL_STYLES = {
  breakout: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  breakdown: 'bg-red-500/20 text-red-400 border-red-500/30',
  bullish: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  bearish: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
} as const

/** Compact signal badge component */
function SignalBadge({ type, label }: { type: keyof typeof SIGNAL_STYLES; label: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SIGNAL_STYLES[type]}`}>
      {label}
    </span>
  )
}

/** Render signal badges for a stock */
function SignalIndicators({ stock }: { stock: Stock }) {
  const signals: JSX.Element[] = []

  if (stock.hasBreakoutPotential) {
    signals.push(<SignalBadge key="bop" type="breakout" label="BO↑" />)
  }
  if (stock.hasBreakoutConfirmed) {
    signals.push(<SignalBadge key="boc" type="breakout" label="BO✓" />)
  }
  if (stock.hasBreakdownPotential) {
    signals.push(<SignalBadge key="bdp" type="breakdown" label="BD↓" />)
  }
  if (stock.hasBreakdownConfirmed) {
    signals.push(<SignalBadge key="bdc" type="breakdown" label="BD✓" />)
  }
  if (stock.hasBullishRSI) {
    signals.push(<SignalBadge key="brsi" type="bullish" label="RSI↑" />)
  }
  if (stock.hasBearishRSI) {
    signals.push(<SignalBadge key="rrsi" type="bearish" label="RSI↓" />)
  }

  if (signals.length === 0) return null

  return <div className="flex flex-wrap gap-1">{signals}</div>
}

export interface ScreenerResultsTableProps {
  sortedStocks: Stock[]
  selectedStocks: ReadonlySet<string>
  loading: boolean
  onToggleRow: (symbol: string) => void
  onToggleAll: () => void
  /** Override empty-state copy (e.g. symbol search with no matches) */
  noRowsMessage?: string
}

/**
 * Memoized so opening dialogs / other parent state does not reconcile 300+ rows.
 */
export const ScreenerResultsTable = memo(function ScreenerResultsTable({
  sortedStocks,
  selectedStocks,
  loading,
  onToggleRow,
  onToggleAll,
  noRowsMessage = 'No stocks found matching your filters.',
}: ScreenerResultsTableProps) {
  if (loading) {
    return (
      <div className="p-10 text-center text-[var(--text-muted)]">
        Loading...
      </div>
    )
  }

  if (sortedStocks.length === 0) {
    return (
      <div className="p-10 text-center text-[var(--text-muted)]">
        {noRowsMessage}
      </div>
    )
  }

  const rowCount = sortedStocks.length
  const allSelected = selectedStocks.size === rowCount && rowCount > 0

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
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
          <TableHead>Chg%</TableHead>
          <TableHead>EMA9</TableHead>
          <TableHead>EMA21</TableHead>
          <TableHead>EMA50</TableHead>
          <TableHead>SMA200</TableHead>
          <TableHead>Signals</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedStocks.map((stock) => (
          <TableRow
            key={stock.symbol}
            selected={selectedStocks.has(stock.symbol)}
          >
            <TableCell>
              <input
                type="checkbox"
                checked={selectedStocks.has(stock.symbol)}
                onChange={() => onToggleRow(stock.symbol)}
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
              {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
            </TableCell>
            <TableCell>{stock.ema9 > 0 ? formatPrice(stock.ema9) : '-'}</TableCell>
            <TableCell>{stock.ema21 > 0 ? formatPrice(stock.ema21) : '-'}</TableCell>
            <TableCell>{stock.ema50 > 0 ? formatPrice(stock.ema50) : '-'}</TableCell>
            <TableCell>{stock.sma200 > 0 ? formatPrice(stock.sma200) : '-'}</TableCell>
            <TableCell>
              <SignalIndicators stock={stock} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
})
