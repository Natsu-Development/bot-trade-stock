import { memo } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatPrice, getBadgeVariantFromExchange } from '@/lib/utils'
import type { Stock } from '@/types'

export interface ScreenerResultsTableProps {
  sortedStocks: Stock[]
  selectedStocks: ReadonlySet<string>
  loading: boolean
  onToggleRow: (symbol: string) => void
  onToggleAll: () => void
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
        No stocks found matching your filters.
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
          <TableHead>Change %</TableHead>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
})
