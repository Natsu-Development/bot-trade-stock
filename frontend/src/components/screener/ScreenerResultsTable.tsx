import { memo } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatPrice, getBadgeVariantFromExchange, cn } from '@/lib/utils'
import type { Stock } from '@/types'

/** Signal configuration with style, label and description */
const SIGNAL_CONFIG = {
  breakoutPotential: {
    style: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    label: 'BO↑',
    description: 'Breakout Potential - Price approaching resistance',
  },
  breakoutConfirmed: {
    style: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    label: 'BO✓',
    description: 'Breakout Confirmed - Price broke above resistance',
  },
  breakdownPotential: {
    style: 'bg-red-500/20 text-red-400 border-red-500/30',
    label: 'BD↓',
    description: 'Breakdown Potential - Price approaching support',
  },
  breakdownConfirmed: {
    style: 'bg-red-500/20 text-red-400 border-red-500/30',
    label: 'BD✓',
    description: 'Breakdown Confirmed - Price broke below support',
  },
  bullishRSI: {
    style: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    label: 'RSI↑',
    description: 'Bullish RSI Divergence - Price down, RSI up',
  },
  bearishRSI: {
    style: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    label: 'RSI↓',
    description: 'Bearish RSI Divergence - Price up, RSI down',
  },
} as const

type SignalType = keyof typeof SIGNAL_CONFIG

/** Compact signal badge component with tooltip */
function SignalBadge({ type }: { type: SignalType }) {
  const config = SIGNAL_CONFIG[type]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border cursor-help ${config.style}`}>
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{config.description}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/** Render signal badges for a stock */
function SignalIndicators({ stock }: { stock: Stock }) {
  const signals: JSX.Element[] = []

  if (stock.hasBreakoutPotential) {
    signals.push(<SignalBadge key="bop" type="breakoutPotential" />)
  }
  if (stock.hasBreakoutConfirmed) {
    signals.push(<SignalBadge key="boc" type="breakoutConfirmed" />)
  }
  if (stock.hasBreakdownPotential) {
    signals.push(<SignalBadge key="bdp" type="breakdownPotential" />)
  }
  if (stock.hasBreakdownConfirmed) {
    signals.push(<SignalBadge key="bdc" type="breakdownConfirmed" />)
  }
  if (stock.hasBullishRSI) {
    signals.push(<SignalBadge key="brsi" type="bullishRSI" />)
  }
  if (stock.hasBearishRSI) {
    signals.push(<SignalBadge key="rrsi" type="bearishRSI" />)
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
  /** Column visibility - if not provided, all columns are shown */
  visibleColumns?: ReadonlySet<string>
  /** Show checkbox column for selection */
  showCheckbox?: boolean
  /** Active sort column id (omit to disable sorting UI) */
  sortField?: string
  /** Active sort direction */
  sortDir?: 'asc' | 'desc'
  /** Called with a column id when a sortable header is clicked */
  onSort?: (columnId: string) => void
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
  visibleColumns,
  showCheckbox = true,
  sortField,
  sortDir,
  onSort,
}: ScreenerResultsTableProps) {
  // Default: show all columns if not specified
  const isVisible = (columnId: string) => !visibleColumns || visibleColumns.has(columnId)

  // Sortable column header: clickable + keyboard-accessible with a direction
  // indicator. Falls back to a plain header when no onSort handler is provided.
  const sortableHead = (columnId: string, label: string) => {
    if (!onSort) return <TableHead>{label}</TableHead>
    const active = sortField === columnId
    return (
      <TableHead aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => onSort(columnId)}
          className="inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer select-none hover:text-[var(--neon-cyan)] transition-colors"
        >
          {label}
          <span
            className={cn(
              'text-[9px] leading-none',
              active ? 'text-[var(--neon-cyan)]' : 'text-[var(--text-muted)] opacity-40'
            )}
            aria-hidden="true"
          >
            {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </TableHead>
    )
  }

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
          {showCheckbox && (
            <TableHead>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                />
              </label>
            </TableHead>
          )}
          {isVisible('symbol') && sortableHead('symbol', 'Symbol')}
          {isVisible('exchange') && sortableHead('exchange', 'Exchange')}
          {isVisible('rs1m') && sortableHead('rs1m', 'RS 1M')}
          {isVisible('rs3m') && sortableHead('rs3m', 'RS 3M')}
          {isVisible('rs6m') && sortableHead('rs6m', 'RS 6M')}
          {isVisible('rs9m') && sortableHead('rs9m', 'RS 9M')}
          {isVisible('rs52w') && sortableHead('rs52w', 'RS 52W')}
          {isVisible('volumeVsSma') && sortableHead('volumeVsSma', 'Vol/SMA')}
          {isVisible('currentVolume') && sortableHead('currentVolume', 'Volume')}
          {isVisible('price') && sortableHead('price', 'Price')}
          {isVisible('change') && sortableHead('change', 'Chg%')}
          {isVisible('ema9') && sortableHead('ema9', 'EMA9')}
          {isVisible('ema21') && sortableHead('ema21', 'EMA21')}
          {isVisible('ema50') && sortableHead('ema50', 'EMA50')}
          {isVisible('sma200') && sortableHead('sma200', 'SMA200')}
          {isVisible('signals') && <TableHead>Signals</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedStocks.map((stock) => (
          <TableRow
            key={stock.symbol}
            selected={selectedStocks.has(stock.symbol)}
          >
            {showCheckbox && (
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedStocks.has(stock.symbol)}
                  onChange={() => onToggleRow(stock.symbol)}
                />
              </TableCell>
            )}
            {isVisible('symbol') && (
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
            )}
            {isVisible('exchange') && (
              <TableCell>
                <Badge variant={getBadgeVariantFromExchange(stock.exchange)}>
                  {stock.exchange}
                </Badge>
              </TableCell>
            )}
            {isVisible('rs1m') && (
              <TableCell className={stock.rs1m !== undefined && stock.rs1m >= 80 ? 'text-[var(--neon-bull)]' : ''}>
                {stock.rs1m ?? '-'}
              </TableCell>
            )}
            {isVisible('rs3m') && (
              <TableCell className={stock.rs3m !== undefined && stock.rs3m >= 80 ? 'text-[var(--neon-bull)]' : ''}>
                {stock.rs3m ?? '-'}
              </TableCell>
            )}
            {isVisible('rs6m') && (
              <TableCell className={stock.rs6m !== undefined && stock.rs6m >= 80 ? 'text-[var(--neon-bull)]' : ''}>
                {stock.rs6m ?? '-'}
              </TableCell>
            )}
            {isVisible('rs9m') && (
              <TableCell className={stock.rs9m !== undefined && stock.rs9m >= 80 ? 'text-[var(--neon-bull)]' : ''}>
                {stock.rs9m ?? '-'}
              </TableCell>
            )}
            {isVisible('rs52w') && (
              <TableCell className={stock.rs52w >= 80 ? 'text-[var(--neon-bull)]' : ''}>
                {stock.rs52w}
              </TableCell>
            )}
            {isVisible('volumeVsSma') && (
              <TableCell className={parseFloat(stock.volume || '') >= 0 ? 'text-[var(--neon-cyan)]' : 'text-[var(--text-muted)]'}>
                {stock.volume}
              </TableCell>
            )}
            {isVisible('currentVolume') && (
              <TableCell className="text-[var(--text-muted)]">
                {stock.currentVolume ? `${(stock.currentVolume / 1000000).toFixed(1)}M` : '-'}
              </TableCell>
            )}
            {isVisible('price') && <TableCell>{formatPrice(stock.price)}</TableCell>}
            {isVisible('change') && (
              <TableCell className={stock.change >= 0 ? 'text-[var(--neon-bull)]' : 'text-[var(--neon-bear)]'}>
                {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
              </TableCell>
            )}
            {isVisible('ema9') && <TableCell>{stock.ema9 > 0 ? formatPrice(stock.ema9) : '-'}</TableCell>}
            {isVisible('ema21') && <TableCell>{stock.ema21 > 0 ? formatPrice(stock.ema21) : '-'}</TableCell>}
            {isVisible('ema50') && <TableCell>{stock.ema50 > 0 ? formatPrice(stock.ema50) : '-'}</TableCell>}
            {isVisible('sma200') && <TableCell>{stock.sma200 > 0 ? formatPrice(stock.sma200) : '-'}</TableCell>}
            {isVisible('signals') && (
              <TableCell>
                <SignalIndicators stock={stock} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
})
