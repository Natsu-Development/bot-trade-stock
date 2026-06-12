import {
  memo,
  forwardRef,
  useImperativeHandle,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPrice, getBadgeVariantFromExchange, cn } from '@/lib/utils'
import type { Stock } from '@/types'

/** Signal configuration with style, label and description */
const SIGNAL_CONFIG = {
  breakoutPotential: {
    style: 'bg-[var(--neon-bull-dim)] text-[var(--neon-bull)] border-[var(--neon-bull-border)]',
    label: 'BO↑',
    description: 'Breakout Potential - Price approaching resistance',
  },
  breakoutConfirmed: {
    style: 'bg-[var(--neon-bull-dim)] text-[var(--neon-bull)] border-[var(--neon-bull-border)]',
    label: 'BO✓',
    description: 'Breakout Confirmed - Price broke above resistance',
  },
  breakdownPotential: {
    style: 'bg-[var(--neon-bear-dim)] text-[var(--neon-bear)] border-[var(--neon-bear-border)]',
    label: 'BD↓',
    description: 'Breakdown Potential - Price approaching support',
  },
  breakdownConfirmed: {
    style: 'bg-[var(--neon-bear-dim)] text-[var(--neon-bear)] border-[var(--neon-bear-border)]',
    label: 'BD✓',
    description: 'Breakdown Confirmed - Price broke below support',
  },
  bullishRSI: {
    style: 'bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)] border-[var(--neon-cyan-border)]',
    label: 'RSI↑',
    description: 'Bullish RSI Divergence - Price down, RSI up',
  },
  bearishRSI: {
    style: 'bg-[var(--neon-amber-dim)] text-[var(--neon-amber)] border-[var(--neon-amber-border)]',
    label: 'RSI↓',
    description: 'Bearish RSI Divergence - Price up, RSI down',
  },
} as const

type SignalType = keyof typeof SIGNAL_CONFIG

/**
 * Compact signal badge. Uses a native `title` for the hover description rather than
 * a Radix <Tooltip>: a result row carries up to 6 of these, so plain spans keep the
 * per-row render cost low.
 */
function SignalBadge({ type }: { type: SignalType }) {
  const config = SIGNAL_CONFIG[type]
  return (
    <span
      title={config.description}
      className={`text-[10px] px-1.5 py-0.5 rounded border cursor-help ${config.style}`}
    >
      {config.label}
    </span>
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

/** Imperative handle exposed to the parent for virtualization-aware scrolling. */
export interface ScreenerResultsTableHandle {
  /** Scroll the row for `symbol` into the viewport (keyboard nav to an off-screen row). */
  scrollToSymbol: (symbol: string) => void
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
  /**
   * Whole-row chart-select handler. Receives the row's symbol.
   * NOTE: there is intentionally NO `activeSymbol` value prop — a churning prop
   * would trip the `memo` and re-render all rows. Active-row state lives in
   * `activeSymbolRef` and is applied via imperative DOM toggle by the parent
   * (Sub-Decision E / C1·R7). Each rendered row also reads it during its own render.
   */
  onSelectRow?: (symbol: string) => void
  /**
   * Read-only ref holding the currently active symbol. Each row reads it DURING its
   * own render to paint its data-active/aria-selected accent — including when the
   * virtualized window shifts a row into view, so the active accent always follows
   * the selected symbol.
   */
  activeSymbolRef?: MutableRefObject<string | null>
  /**
   * Ref set true while a splitter drag is in progress. The row onClick early-
   * returns when set, so a drag that ends over a row does not chart it (gap a).
   */
  dragInProgressRef?: MutableRefObject<boolean>
  /**
   * When true (chart collapsed), reveal the extra columns (RS1M, RS3M, Vol/SMA)
   * regardless of the persisted visibleColumns set.
   */
  showExtraColumns?: boolean
  /**
   * The scroll container element that owns the vertical overflow (the list pane).
   * When provided, rows are VIRTUALIZED — only those within this viewport
   * (+overscan) render, so a 1000+ row result set stays cheap to re-render on a
   * filter change. Passed as the resolved ELEMENT (via state), not a ref, so the
   * virtualizer re-attaches its rect observer once the laid-out element exists.
   * When omitted (e.g. the Dashboard's small top-N table), all rows render.
   */
  scrollElement?: HTMLElement | null
}

/** Stable DOM id for a screener row, shared by the table + Screener wrapper. */
export function screenerRowId(symbol: string): string {
  return `screener-row-${symbol}`
}

/** Extra columns revealed only when the chart is collapsed (Story 1/4 col-extra). */
const EXTRA_COLUMNS = new Set(['rs1m', 'rs3m', 'volumeVsSma'])

/** Initial row-height estimate for the virtualizer; actual heights are measured. */
const ROW_ESTIMATE = 49

/**
 * Column-visibility decision shared by the header and the (memoized) rows. Pure,
 * so it can be called from the row component without a per-render closure prop
 * (which would trip the row `memo`).
 */
function isColumnVisible(
  columnId: string,
  visibleColumns: ReadonlySet<string> | undefined,
  showExtraColumns: boolean
): boolean {
  return (
    (showExtraColumns && EXTRA_COLUMNS.has(columnId)) ||
    !visibleColumns ||
    visibleColumns.has(columnId)
  )
}

interface ScreenerRowProps {
  stock: Stock
  /** Checkbox selection state for THIS row (primitive → only the toggled row re-renders). */
  selected: boolean
  showCheckbox: boolean
  visibleColumns?: ReadonlySet<string>
  showExtraColumns: boolean
  onToggleRow: (symbol: string) => void
  onSelectRow?: (symbol: string) => void
  activeSymbolRef?: MutableRefObject<string | null>
  dragInProgressRef?: MutableRefObject<boolean>
  /** Virtualizer item index — read by `measureElement` via the `data-index` attr. */
  dataIndex: number
}

/**
 * One screener result row, memoized so toggling a single SELECTION re-renders ONLY
 * the changed row. Forwards its ref to the underlying <tr> so the virtualizer can
 * measure it (dynamic row heights). The active-row accent is read from
 * `activeSymbolRef` during render; navigation between already-rendered rows is
 * applied imperatively by the parent.
 */
const ScreenerRow = memo(
  forwardRef<HTMLTableRowElement, ScreenerRowProps>(function ScreenerRow(
    {
      stock,
      selected,
      showCheckbox,
      visibleColumns,
      showExtraColumns,
      onToggleRow,
      onSelectRow,
      activeSymbolRef,
      dragInProgressRef,
      dataIndex,
    },
    ref
  ) {
    const isActive = activeSymbolRef?.current === stock.symbol
    const vis = (columnId: string) => isColumnVisible(columnId, visibleColumns, showExtraColumns)

    // Whole-row chart-select. Isolated from the checkbox (Principle 3) and from a
    // splitter-drag-release (gap a).
    const handleRowClick = (event: ReactMouseEvent<HTMLTableRowElement>): void => {
      if (!onSelectRow) return
      if (dragInProgressRef?.current) return
      const target = event.target as HTMLElement
      if (target.closest('input[type=checkbox], [role=checkbox]')) return
      onSelectRow(stock.symbol)
    }

    return (
      <TableRow
        ref={ref}
        data-index={dataIndex}
        id={screenerRowId(stock.symbol)}
        role="row"
        selected={selected}
        data-symbol={stock.symbol}
        data-active={isActive ? 'true' : undefined}
        aria-selected={isActive}
        onClick={handleRowClick}
        className={cn(
          'cursor-pointer border-l-2 border-l-transparent transition-colors',
          'data-[active=true]:bg-[var(--neon-cyan-dim)] data-[active=true]:!border-l-[var(--neon-cyan)]'
        )}
      >
        {showCheckbox && (
          <TableCell role="gridcell">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleRow(stock.symbol)}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Select ${stock.symbol}`}
            />
          </TableCell>
        )}
        {vis('symbol') && (
          <TableCell role="gridcell">
            <button
              type="button"
              data-testid="screener-symbol-button"
              data-symbol={stock.symbol}
              aria-label={stock.symbol}
              onClick={() => onSelectRow?.(stock.symbol)}
              className="flex items-center gap-2.5 text-left"
            >
              <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-hover)] flex items-center justify-center text-[10px] font-semibold text-[var(--neon-cyan)] border border-[var(--border-glow)]">
                {stock.symbol}
              </div>
              <span className="font-semibold text-[var(--text-primary)] font-display">
                {stock.name}
              </span>
            </button>
          </TableCell>
        )}
        {vis('exchange') && (
          <TableCell role="gridcell">
            <Badge variant={getBadgeVariantFromExchange(stock.exchange)}>{stock.exchange}</Badge>
          </TableCell>
        )}
        {vis('rs1m') && (
          <TableCell
            role="gridcell"
            className={
              stock.rs1m !== undefined && stock.rs1m >= 80 ? 'text-[var(--neon-bull)]' : ''
            }
          >
            {stock.rs1m ?? '-'}
          </TableCell>
        )}
        {vis('rs3m') && (
          <TableCell
            role="gridcell"
            className={
              stock.rs3m !== undefined && stock.rs3m >= 80 ? 'text-[var(--neon-bull)]' : ''
            }
          >
            {stock.rs3m ?? '-'}
          </TableCell>
        )}
        {vis('rs6m') && (
          <TableCell
            role="gridcell"
            className={
              stock.rs6m !== undefined && stock.rs6m >= 80 ? 'text-[var(--neon-bull)]' : ''
            }
          >
            {stock.rs6m ?? '-'}
          </TableCell>
        )}
        {vis('rs9m') && (
          <TableCell
            role="gridcell"
            className={
              stock.rs9m !== undefined && stock.rs9m >= 80 ? 'text-[var(--neon-bull)]' : ''
            }
          >
            {stock.rs9m ?? '-'}
          </TableCell>
        )}
        {vis('rs52w') && (
          <TableCell role="gridcell" className={stock.rs52w >= 80 ? 'text-[var(--neon-bull)]' : ''}>
            {stock.rs52w}
          </TableCell>
        )}
        {vis('volumeVsSma') && (
          <TableCell
            role="gridcell"
            className={
              parseFloat(stock.volume || '') >= 0
                ? 'text-[var(--neon-cyan)]'
                : 'text-[var(--text-muted)]'
            }
          >
            {stock.volume}
          </TableCell>
        )}
        {vis('currentVolume') && (
          <TableCell role="gridcell" className="text-[var(--text-muted)]">
            {stock.currentVolume ? `${(stock.currentVolume / 1000000).toFixed(1)}M` : '-'}
          </TableCell>
        )}
        {vis('price') && <TableCell role="gridcell">{formatPrice(stock.price)}</TableCell>}
        {vis('change') && (
          <TableCell
            role="gridcell"
            className={stock.change >= 0 ? 'text-[var(--neon-bull)]' : 'text-[var(--neon-bear)]'}
          >
            {stock.change >= 0 ? '+' : ''}
            {stock.change.toFixed(2)}%
          </TableCell>
        )}
        {vis('ema9') && (
          <TableCell role="gridcell">{stock.ema9 > 0 ? formatPrice(stock.ema9) : '-'}</TableCell>
        )}
        {vis('ema21') && (
          <TableCell role="gridcell">{stock.ema21 > 0 ? formatPrice(stock.ema21) : '-'}</TableCell>
        )}
        {vis('ema50') && (
          <TableCell role="gridcell">{stock.ema50 > 0 ? formatPrice(stock.ema50) : '-'}</TableCell>
        )}
        {vis('sma200') && (
          <TableCell role="gridcell">
            {stock.sma200 > 0 ? formatPrice(stock.sma200) : '-'}
          </TableCell>
        )}
        {vis('signals') && (
          <TableCell role="gridcell">
            <SignalIndicators stock={stock} />
          </TableCell>
        )}
      </TableRow>
    )
  })
)

/**
 * Virtualized results table: only the rows within the scroll viewport (+overscan)
 * are rendered, so re-rendering on a filter change (or unselect → all stocks) stays
 * cheap regardless of result-set size. Spacer rows above/below preserve the native
 * scroll height + column alignment; `measureElement` records real row heights.
 */
const ScreenerResultsTableInner = forwardRef<ScreenerResultsTableHandle, ScreenerResultsTableProps>(
  function ScreenerResultsTable(
    {
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
      onSelectRow,
      activeSymbolRef,
      dragInProgressRef,
      showExtraColumns = false,
      scrollElement,
    },
    handleRef
  ) {
    const isVisible = (columnId: string) =>
      isColumnVisible(columnId, visibleColumns, showExtraColumns)

    const rowVirtualizer = useVirtualizer({
      count: sortedStocks.length,
      getScrollElement: () => scrollElement ?? null,
      estimateSize: () => ROW_ESTIMATE,
      overscan: 16,
      getItemKey: (index) => sortedStocks[index]?.symbol ?? index,
    })

    useImperativeHandle(
      handleRef,
      () => ({
        scrollToSymbol: (symbol: string) => {
          const idx = sortedStocks.findIndex((s) => s.symbol === symbol)
          if (idx >= 0) rowVirtualizer.scrollToIndex(idx, { align: 'auto' })
        },
      }),
      [rowVirtualizer, sortedStocks]
    )

    // Sortable column header: clickable + keyboard-accessible with a direction
    // indicator. Falls back to a plain header when no onSort handler is provided.
    const sortableHead = (columnId: string, label: string) => {
      if (!onSort) return <TableHead role="columnheader">{label}</TableHead>
      const active = sortField === columnId
      return (
        <TableHead
          role="columnheader"
          aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
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
      return <div className="p-10 text-center text-[var(--text-muted)]">Loading...</div>
    }

    if (sortedStocks.length === 0) {
      return <div className="p-10 text-center text-[var(--text-muted)]">{noRowsMessage}</div>
    }

    const rowCount = sortedStocks.length
    const allSelected = selectedStocks.size === rowCount && rowCount > 0

    const virtualItems = rowVirtualizer.getVirtualItems()
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
    const paddingBottom =
      virtualItems.length > 0
        ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
        : 0
    // Upper bound for spacer colSpan (HTML caps it at the real column count).
    const SPACER_COLSPAN = 20

    return (
      <Table role="grid">
        <TableHeader>
          <TableRow role="row">
            {showCheckbox && (
              <TableHead role="columnheader">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => onToggleAll()}
                  aria-label="Select all rows"
                />
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
            {isVisible('signals') && <TableHead role="columnheader">Signals</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {scrollElement ? (
            <>
              {paddingTop > 0 && (
                <tr aria-hidden="true" style={{ height: paddingTop, border: 0 }}>
                  <td colSpan={SPACER_COLSPAN} style={{ padding: 0, border: 0 }} />
                </tr>
              )}
              {virtualItems.map((vi) => {
                const stock = sortedStocks[vi.index]
                return (
                  <ScreenerRow
                    key={vi.key as string}
                    ref={rowVirtualizer.measureElement}
                    dataIndex={vi.index}
                    stock={stock}
                    selected={selectedStocks.has(stock.symbol)}
                    showCheckbox={showCheckbox}
                    visibleColumns={visibleColumns}
                    showExtraColumns={showExtraColumns}
                    onToggleRow={onToggleRow}
                    onSelectRow={onSelectRow}
                    activeSymbolRef={activeSymbolRef}
                    dragInProgressRef={dragInProgressRef}
                  />
                )
              })}
              {paddingBottom > 0 && (
                <tr aria-hidden="true" style={{ height: paddingBottom, border: 0 }}>
                  <td colSpan={SPACER_COLSPAN} style={{ padding: 0, border: 0 }} />
                </tr>
              )}
            </>
          ) : (
            // No scroll container provided (e.g. Dashboard's small top-N table) → render
            // every row; virtualization only kicks in when a scrollElementRef is passed.
            sortedStocks.map((stock, i) => (
              <ScreenerRow
                key={stock.symbol}
                dataIndex={i}
                stock={stock}
                selected={selectedStocks.has(stock.symbol)}
                showCheckbox={showCheckbox}
                visibleColumns={visibleColumns}
                showExtraColumns={showExtraColumns}
                onToggleRow={onToggleRow}
                onSelectRow={onSelectRow}
                activeSymbolRef={activeSymbolRef}
                dragInProgressRef={dragInProgressRef}
              />
            ))
          )}
        </TableBody>
      </Table>
    )
  }
)

/**
 * Memoized so opening dialogs / other parent state does not reconcile the rows.
 * Row virtualization keeps a filter-change re-render cheap (only the viewport's
 * rows render); each row is a memoized <ScreenerRow> so a single selection toggle
 * re-renders only the changed row.
 */
export const ScreenerResultsTable = memo(ScreenerResultsTableInner)
