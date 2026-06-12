import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useDeferredValue,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '../icons/Icons'
import { cn } from '@/lib/utils'
import { api, getConfigId, type ApiWatchlistItem } from '../../lib/api'
import { toast } from '../ui/Toast'
import { handleError } from '../../lib/errors'
import {
  transformApiStocks,
  sortStocks,
  isSortableColumn,
  isNumericSortField,
  type ScreenerSortField,
  type SortDirection,
} from '../../lib/screenerUtils'
import { formulaToText } from '../../lib/filterSerialize'
import { FilterBar } from '../screener/FilterBar'
import { SavedFilterChips } from '../screener/SavedFilterChips'
import {
  ScreenerResultsTable,
  screenerRowId,
  type ScreenerResultsTableHandle,
} from '../screener/ScreenerResultsTable'
import { ColumnSelector } from '../screener/ColumnSelector'
import { SymbolDetailPanel } from '../screener/SymbolDetailPanel'
import { useScreenerFilters } from '../../hooks/screener/useScreenerFilters'
import { useStockSelection } from '../../hooks/screener/useStockSelection'
import { useTableColumns } from '../../hooks/useTableColumns'
import { useDebounce, SYMBOL_DEBOUNCE_MS } from '../../hooks/useDebounce'
import { SearchBox } from '../features/SearchBox'
import type { Stock } from '../../types'

export function Screener() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [activeExchange, setActiveExchange] = useState('All')
  // Collapsed by default so the Results table + chart are the first thing visible
  // (the tall filter otherwise pushes them below the fold). The collapsed header
  // still shows the active-filter summary, and one click expands the full builder.
  const [filterExpanded, setFilterExpanded] = useState(false)
  const [addingToWatchlist, setAddingToWatchlist] = useState(false)
  const [symbolSearch, setSymbolSearch] = useState('')
  const deferredSymbolSearch = useDeferredValue(symbolSearch)

  // Custom hooks
  const {
    filterTree,
    loadedPreset,
    isModified,
    appliedTree,
    dirty,
    savedFilters,
    builderOpen,
    setFilterTree,
    selectBuiltIn,
    openBuilder,
    closeBuilder,
    applyBuilder,
    applyFilter,
    handleReset,
    savePreset,
    handleLoadPreset,
    handleDeletePreset,
    getFilterRequest,
  } = useScreenerFilters()

  // Compact active-filter summary shown in the COLLAPSED filter header, so the user
  // still sees what's being filtered without expanding the full builder.
  const filterSummary = useMemo(() => formulaToText(appliedTree), [appliedTree])

  // Table column visibility
  const {
    visibleColumns,
    toggleColumn,
    resetToDefaults: resetColumns,
    columnsByCategory,
  } = useTableColumns()

  // Per-column sort (client-side). Default: symbol ascending.
  const [sort, setSort] = useState<{ field: ScreenerSortField; dir: SortDirection }>({
    field: 'symbol',
    dir: 'asc',
  })

  // Stable identity: isSortableColumn/isNumericSortField are pure module functions,
  // not reactive values, so an empty dep array is correct.
  const handleSort = useCallback((columnId: string) => {
    if (!isSortableColumn(columnId)) return
    setSort((prev) =>
      prev.field === columnId
        ? { field: prev.field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field: columnId, dir: isNumericSortField(columnId) ? 'desc' : 'asc' }
    )
  }, [])

  const sortedStocks = useMemo(() => sortStocks(stocks, sort.field, sort.dir), [stocks, sort])

  const displayStocks = useMemo(() => {
    const q = deferredSymbolSearch.trim().toUpperCase()
    if (!q) return sortedStocks
    return sortedStocks.filter((s) => s.symbol.toUpperCase().includes(q))
  }, [sortedStocks, deferredSymbolSearch])

  const { selectedStocks, handleToggleStockSelection, handleToggleAllSelection, clearSelection } =
    useStockSelection(displayStocks)

  // ── Master–detail split state ───────────────────────────────────────────────
  // Chart pane defaults to COLLAPSED so the results table is full-width on load;
  // the user opens the chart via the "Chart" toggle (it then fills its frame). The
  // responsive matchMedia guard below only ever forces this false, so a false
  // default is consistent across viewports.
  const [chartVisible, setChartVisible] = useState(false)
  const [refitNonce, setRefitNonce] = useState(0)

  // Active (charted) symbol — symbol, NOT index, so re-sorts preserve it (gap b).
  // This state legitimately re-renders Screener (debounce feed + panel), NOT the
  // memo'd table. The table reads `activeSymbolRef` instead (C1/R7).
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const activeSymbolRef = useRef<string | null>(null)
  const dragInProgressRef = useRef(false)
  const listRegionRef = useRef<HTMLDivElement | null>(null)
  // Imperative handle to the virtualized results table — used to scroll an
  // off-screen active row into the rendered window on keyboard navigation.
  const tableRef = useRef<ScreenerResultsTableHandle>(null)
  // The list pane is the scroll container the results table virtualizes against.
  // Tracked in STATE (set via the stable callback ref below) so the virtualizer
  // re-attaches its rect observer once the laid-out element exists — a plain ref
  // mutation would not re-trigger that, leaving the virtual window empty.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const setListPaneRef = useCallback((node: HTMLDivElement | null) => {
    paneListRef.current = node
    listRegionRef.current = node
    setScrollEl(node)
  }, [])

  // Imperative DOM toggle of active-row attributes on ONLY the prior + new row
  // nodes, plus aria-activedescendant on the region wrapper — zero row re-renders
  // (Sub-Decision E). Keep activeSymbolRef in lockstep so re-render reads are
  // correct, and scroll the new active row into view.
  const applyActiveSymbol = useCallback((next: string | null): void => {
    const prev = activeSymbolRef.current
    if (prev === next) return
    activeSymbolRef.current = next

    if (prev) {
      const prevNode = document.getElementById(screenerRowId(prev))
      if (prevNode) {
        prevNode.removeAttribute('data-active')
        prevNode.setAttribute('aria-selected', 'false')
      }
    }
    if (next) {
      // Bring the active row into the virtualized window (no-op if already visible).
      // If it was off-screen its node won't exist yet — the row paints data-active
      // from activeSymbolRef when it mounts; if already rendered, the imperative
      // toggle below paints it immediately.
      tableRef.current?.scrollToSymbol(next)
      const nextNode = document.getElementById(screenerRowId(next))
      if (nextNode) {
        nextNode.setAttribute('data-active', 'true')
        nextNode.setAttribute('aria-selected', 'true')
      }
    }
    const region = listRegionRef.current
    if (region) {
      if (next) region.setAttribute('aria-activedescendant', screenerRowId(next))
      else region.removeAttribute('aria-activedescendant')
    }
  }, [])

  // Stable selection setter. Selecting a row while collapsed re-shows the chart.
  // After a click-select, return DOM focus to the list region so subsequent
  // ArrowUp/Down/Enter/Space are handled by the region keydown handler (the guard
  // early-returns when focus is on a child button, so we must move focus back).
  const handleSelectRow = useCallback((symbol: string): void => {
    setActiveSymbol(symbol)
    setChartVisible((vis) => {
      if (!vis) {
        setRefitNonce((n) => n + 1)
        return true
      }
      return vis
    })
    listRegionRef.current?.focus({ preventScroll: true })
  }, [])

  // Single source of truth for default/active selection (M3). Covers: default on
  // load, refetch re-default (G3), search-filters-out-active (→ re-default), and
  // zero-rows (→ null). Mirrors into the ref + DOM via applyActiveSymbol.
  useEffect(() => {
    setActiveSymbol((prev) =>
      prev && displayStocks.some((s) => s.symbol === prev)
        ? prev
        : (displayStocks[0]?.symbol ?? null)
    )
  }, [displayStocks])

  // Keep the ref + DOM attributes in sync whenever the React active symbol moves.
  useEffect(() => {
    applyActiveSymbol(activeSymbol)
  }, [activeSymbol, applyActiveSymbol])

  // The list region is `display:none` while the builder/picker modal is open (perf:
  // keeps the 229 rows out of style/layout recalc). Hiding a focused element blurs it
  // to <body>, so when the modal closes restore focus to the region to keep roving
  // ArrowUp/Down navigation working. Skip the initial mount so we never steal focus on
  // page load — only refocus on an actual close transition.
  const builderWasOpenRef = useRef(false)
  useEffect(() => {
    if (!builderOpen && builderWasOpenRef.current) {
      listRegionRef.current?.focus({ preventScroll: true })
    }
    builderWasOpenRef.current = builderOpen
  }, [builderOpen])

  // Responsive (M4/R9): matchMedia → React state forces chartVisible=false below
  // 1024px so the hook `enabled` gate truly suppresses the fetch. NOT a CSS-only
  // breakpoint (CSS hiding still mounts + fetches). Guard like useNavigation.ts.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(max-width: 1023px)')
    const apply = (matches: boolean): void => {
      if (matches) setChartVisible(false)
    }
    apply(mql.matches)
    const onChange = (e: MediaQueryListEvent): void => apply(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  // Debounced feed (concern C / M2): only the symbol that FEEDS the chart fetch is
  // debounced; the first/default value passes through instantly (useDebounce seeds
  // its initial value). NOT useDeferredValue.
  const debouncedActiveSymbol = useDebounce(activeSymbol, SYMBOL_DEBOUNCE_MS)

  // Resolve the active Stock by the DEBOUNCED symbol → Stock | undefined (G4).
  // This feeds the (debounced) chart fetch.
  const selectedStock = useMemo(
    () => displayStocks.find((s) => s.symbol === debouncedActiveSymbol),
    [displayStocks, debouncedActiveSymbol]
  )

  // Immediate active Stock (NOT debounced) for the instant panel header.
  const activeStock = useMemo(
    () => displayStocks.find((s) => s.symbol === activeSymbol),
    [displayStocks, activeSymbol]
  )

  // prev/next move the active symbol to the adjacent row (wrap), per prototype.
  const moveActive = useCallback(
    (delta: number): void => {
      setActiveSymbol((prev) => {
        if (displayStocks.length === 0) return null
        const idx = displayStocks.findIndex((s) => s.symbol === prev)
        const base = idx < 0 ? 0 : idx
        const nextIdx = (base + delta + displayStocks.length) % displayStocks.length
        return displayStocks[nextIdx].symbol
      })
    },
    [displayStocks]
  )

  const toggleChart = useCallback((): void => {
    setChartVisible((vis) => {
      const next = !vis
      if (next) setRefitNonce((n) => n + 1)
      return next
    })
  }, [])

  // Space toggles the active row's checkbox (keyboard multi-select, C2/R6).
  const handleToggleActiveCheckbox = useCallback((): void => {
    const sym = activeSymbolRef.current
    if (sym) handleToggleStockSelection(sym)
  }, [handleToggleStockSelection])

  // List-region-scoped keydown (Story 4a). NOT document-global.
  const handleListKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      // R4: ignore keys originating inside any interactive control (sortable header
      // buttons, checkboxes, the symbol button, links).
      const target = event.target as HTMLElement
      if (target !== event.currentTarget && target.closest('button, input, a, [role=checkbox]')) {
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveActive(1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveActive(-1)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const sym = activeSymbolRef.current
        if (sym) handleSelectRow(sym)
      } else if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()
        handleToggleActiveCheckbox()
      }
    },
    [moveActive, handleSelectRow, handleToggleActiveCheckbox]
  )

  // Splitter drag (gap a): clamp list width; mark drag in progress so a drag
  // ending over a row does not chart it; bump refitNonce on drag-END.
  const splitRef = useRef<HTMLDivElement | null>(null)
  const paneListRef = useRef<HTMLDivElement | null>(null)
  const handleSplitterMouseDown = useCallback((): void => {
    dragInProgressRef.current = true
    document.body.style.userSelect = 'none'

    const onMove = (e: MouseEvent): void => {
      const split = splitRef.current
      const pane = paneListRef.current
      if (!split || !pane) return
      const rect = split.getBoundingClientRect()
      const w = Math.min(Math.max(e.clientX - rect.left, 320), rect.width - 420)
      pane.style.width = `${w}px`
    }
    const onUp = (): void => {
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // Clear the drag flag on the next tick so the row click that fires on this
      // same mouseup is suppressed.
      setRefitNonce((n) => n + 1)
      window.setTimeout(() => {
        dragInProgressRef.current = false
      }, 0)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // Ref keeps latest getFilterRequest without destabilizing fetchStocks
  const getFilterRequestRef = useRef(getFilterRequest)
  getFilterRequestRef.current = getFilterRequest

  const fetchStocks = useCallback(async () => {
    setLoading(true)
    try {
      const filterRequest = getFilterRequestRef.current()

      const response = await api.filterStocks({
        ...filterRequest,
        exchanges: activeExchange !== 'All' ? [activeExchange] : undefined,
      })

      const converted = transformApiStocks(response.stocks)
      setStocks(converted)
      clearSelection()

      if (converted.length === 0) {
        toast.info('No stocks found matching your filters')
      }
    } catch (error) {
      handleError(error, 'Failed to fetch stocks')
      setStocks([])
    } finally {
      setLoading(false)
    }
  }, [activeExchange, clearSelection])

  // Refetch when the APPLIED tree changes (preset load, builder "Done", explicit
  // Apply, and Reset all commit it) or the exchange changes. Free-text formula
  // edits do NOT change appliedTree (→ dirty) so a half-typed query never fires.
  useEffect(() => {
    fetchStocks()
  }, [fetchStocks, appliedTree])

  // Apply commits the edited tree to the results (hybrid model). The fetch fires
  // via the appliedTree effect above.
  const handleApplyFilters = useCallback(() => {
    applyFilter()
  }, [applyFilter])

  const handleResetWithExchange = useCallback(() => {
    setActiveExchange('All')
    handleReset()
  }, [handleReset])

  // "Add to watchlist" = add the selected symbols to the config's watchlist.
  // Each new symbol is seeded with one default, always-submittable signal condition
  // (bullish_divergence: no threshold/reference) so the entry persists; the user can
  // refine conditions later on the Config page. Symbols already in the watchlist are skipped.
  // NOTE: this is a read-modify-write on the FULL config — if the Config page is open
  // in another tab and saved between this GET and PUT, last-write-wins. Acceptable for
  // single-tab use; revisit with an atomic PATCH /config/:id/watchlist if that changes.
  const handleAddToWatchlist = useCallback(async () => {
    const symbols = Array.from(selectedStocks)
    if (symbols.length === 0) return
    setAddingToWatchlist(true)
    try {
      const configId = getConfigId()
      const cfg = await api.getConfig(configId)
      const existing = new Set((cfg.watchlist ?? []).map((a) => a.symbol.toUpperCase()))
      const fresh = symbols.filter((s) => !existing.has(s.toUpperCase()))
      if (fresh.length === 0) {
        toast.info('Selected symbol(s) are already in your watchlist')
        clearSelection()
        return
      }
      const added: ApiWatchlistItem[] = fresh.map((symbol) => ({
        symbol,
        conditions: [{ type: 'bullish_divergence', threshold: 0, enabled: true }],
      }))
      await api.updateConfig(configId, { ...cfg, watchlist: [...(cfg.watchlist ?? []), ...added] })
      toast.success(
        `Added ${fresh.length} symbol${fresh.length === 1 ? '' : 's'} to your watchlist`
      )
      clearSelection()
    } catch (error) {
      handleError(error, 'Failed to add to watchlist')
    } finally {
      setAddingToWatchlist(false)
    }
  }, [selectedStocks, clearSelection])

  return (
    <div className="animate-slide-in-from-bottom">
      <Card className="mb-6">
        {/* Header row IS the collapse toggle — leading chevron, whole row clickable
            (matches WatchlistRow / FilterPresetCard on the Config page). */}
        <button
          type="button"
          onClick={() => setFilterExpanded((v) => !v)}
          aria-expanded={filterExpanded}
          aria-label={filterExpanded ? 'Collapse filter conditions' : 'Expand filter conditions'}
          className="flex w-full items-center gap-2.5 border-b border-[var(--border-dim)] px-5 py-4 text-left transition-colors hover:bg-[var(--bg-surface)]"
        >
          <Icons.ChevronRight
            className={cn(
              'h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-150',
              filterExpanded && 'rotate-90'
            )}
          />
          <Icons.Filter className="h-[18px] w-[18px] flex-shrink-0 text-[var(--neon-cyan)]" />
          <span className="flex-shrink-0 font-medium text-[var(--text-primary)]">
            Filter Conditions
          </span>
          {!filterExpanded && (
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text-muted)]">
              {filterSummary || '(all stocks)'}
            </span>
          )}
        </button>
        {/* Collapsed quick-pick: select a saved filter without expanding the builder.
            Sibling of the toggle button (never nested — no button-in-button). Clicking a
            chip loads + auto-applies (results refetch + the collapsed summary updates);
            the panel stays collapsed. */}
        {!filterExpanded && savedFilters.length > 0 && (
          <div
            data-testid="saved-filters-quickpick"
            className="flex flex-wrap items-center gap-2 border-b border-[var(--border-dim)] px-5 py-2.5"
          >
            <span className="flex-shrink-0 text-[12px] font-medium text-[var(--text-muted)]">
              Saved:
            </span>
            <SavedFilterChips
              savedFilters={savedFilters}
              loadedPreset={loadedPreset}
              isModified={isModified}
              onLoad={handleLoadPreset}
            />
          </div>
        )}
        {filterExpanded && (
          <Card.Body>
            <FilterBar
              filterTree={filterTree}
              loadedPreset={loadedPreset}
              isModified={isModified}
              activeExchange={activeExchange}
              builderOpen={builderOpen}
              savedFilters={savedFilters}
              onTreeChange={setFilterTree}
              onSelectBuiltIn={selectBuiltIn}
              onExchangeChange={setActiveExchange}
              onOpenBuilder={openBuilder}
              onCloseBuilder={closeBuilder}
              onApplyBuilder={applyBuilder}
              onLoadPreset={handleLoadPreset}
              onDeletePreset={handleDeletePreset}
              onSavePreset={(root, exchanges, name) => savePreset(name, root, exchanges)}
            />
            {/* Footer — Reset / Apply at the END of the section (Apply carries the
                unapplied-changes dot from the hybrid model). */}
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--border-dim)] pt-4">
              <Button variant="ghost" icon="RotateCcw" onClick={handleResetWithExchange}>
                <span>Reset</span>
              </Button>
              <Button icon="Filter" onClick={handleApplyFilters} disabled={loading}>
                <span>{loading ? 'Loading...' : 'Apply'}</span>
                {!loading && dirty && (
                  <span
                    aria-hidden="true"
                    data-testid="apply-dirty-dot"
                    title="Unapplied changes"
                    className="ml-1 inline-block h-2 w-2 rounded-full bg-[var(--bg-void)]"
                  />
                )}
              </Button>
            </div>
          </Card.Body>
        )}
      </Card>

      <Card>
        <Card.Header
          action={
            <div className="flex gap-2">
              <ColumnSelector
                columnsByCategory={columnsByCategory}
                visibleColumns={visibleColumns}
                onToggle={toggleColumn}
                onReset={resetColumns}
              />
              <Button variant="ghost" size="sm" icon="GridSmall">
                <span>Export CSV</span>
              </Button>
            </div>
          }
        >
          <Icons.Grid />
          <span>
            Results{' '}
            <span className="text-[var(--text-muted)] font-mono ml-2">
              {deferredSymbolSearch.trim()
                ? `${displayStocks.length} of ${sortedStocks.length} stocks`
                : `${sortedStocks.length} stocks`}
            </span>
          </span>
        </Card.Header>
        <Card.Body className="!p-0">
          {selectedStocks.size > 0 && (
            <div className="flex items-center gap-3 border-b border-[var(--border-dim)] bg-[var(--neon-cyan-dim)] px-4 py-2.5">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {selectedStocks.size} selected
              </span>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <span>Clear</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="Plus"
                onClick={handleAddToWatchlist}
                disabled={addingToWatchlist}
              >
                <span>{addingToWatchlist ? 'Adding…' : 'Add to watchlist'}</span>
              </Button>
            </div>
          )}
          <div className="px-4 py-3 border-b border-[var(--border-dim)] flex items-center gap-3">
            <div className="flex-1">
              <SearchBox
                placeholder="Search symbol in results (e.g. VCB)..."
                onSearch={setSymbolSearch}
              />
            </div>
            <button
              type="button"
              onClick={toggleChart}
              aria-pressed={chartVisible}
              title="Show/hide chart pane"
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors',
                chartVisible
                  ? 'text-[var(--neon-cyan)] border-[var(--neon-cyan)] bg-[var(--neon-cyan-dim)]'
                  : 'text-[var(--text-secondary)] border-[var(--border-dim)] hover:bg-[var(--bg-hover)]'
              )}
            >
              <Icons.BarChart />
              <span>Chart</span>
            </button>
          </div>

          {/* Master–detail split: LEFT results table, RIGHT persistent chart pane.
              Height fills the viewport (minus the page chrome above) so — with the
              filter collapsed by default — the table and chart are both large and
              visible together without scrolling the document. Clamped to a sensible
              minimum for short viewports. */}
          <div
            ref={splitRef}
            className="flex min-h-0"
            style={{ height: 'max(440px, calc(100dvh - 232px))' }}
          >
            {/* LEFT — list region (the single roving focus owner; a11y wrapper
                lives OUTSIDE the memo'd table). */}
            <div
              ref={setListPaneRef}
              role="region"
              aria-label="Screener results"
              tabIndex={0}
              onKeyDown={handleListKeyDown}
              // BLOCK (not flex): this region IS the scroll container the results
              // virtualizer attaches to (scrollElement={scrollEl}). As a flex column the
              // inner <Table> `overflow-x-auto` wrapper — whose overflow-y is promoted to
              // `auto`, and whose flex auto-min-height collapses to 0 — would shrink to the
              // pane height and become the REAL vertical scroller, leaving THIS region
              // unscrollable so the virtual window never advances (blank rows on scroll).
              // As a block, the wrapper grows to its content height and this region scrolls.
              className="block overflow-auto focus:outline-none"
              // While the builder/picker modal covers the page, take the 229-row table
              // out of layout+style-recalc with display:none. Measured (6x CPU throttle):
              // this cuts per-toggle work in the picker from ~71ms to ~28ms and removes
              // all long tasks — the rows are recalculated on every commit otherwise.
              // `display:none` (not unmount): the table stays mounted, so row ids remain
              // in the DOM for the active-row ref-repaint + aria-activedescendant, and
              // there is no remount hitch on close. Inline style beats the className.
              style={{
                width: chartVisible ? '52%' : '100%',
                minWidth: 0,
                display: builderOpen ? 'none' : undefined,
              }}
            >
              <ScreenerResultsTable
                ref={tableRef}
                scrollElement={scrollEl}
                sortedStocks={displayStocks}
                selectedStocks={selectedStocks}
                loading={loading}
                onToggleRow={handleToggleStockSelection}
                onToggleAll={handleToggleAllSelection}
                visibleColumns={visibleColumns}
                sortField={sort.field}
                sortDir={sort.dir}
                onSort={handleSort}
                onSelectRow={handleSelectRow}
                activeSymbolRef={activeSymbolRef}
                dragInProgressRef={dragInProgressRef}
                showExtraColumns={!chartVisible}
                noRowsMessage={
                  deferredSymbolSearch.trim() && sortedStocks.length > 0
                    ? 'No symbols match your search.'
                    : undefined
                }
              />
            </div>

            {chartVisible && (
              <>
                {/* Draggable vertical splitter (hidden when collapsed). */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize chart pane"
                  onMouseDown={handleSplitterMouseDown}
                  className="w-1.5 flex-shrink-0 cursor-col-resize bg-[var(--border-dim)] hover:bg-[var(--neon-cyan)] transition-colors"
                />
                {/* RIGHT — chart region. */}
                <div
                  role="region"
                  aria-label="Symbol detail chart"
                  className="flex-1 min-w-0 flex flex-col min-h-0"
                >
                  {/* Collapse is via the "Chart" toggle in the results toolbar;
                      symbol navigation is via the results table (click / ↑↓ keys). */}
                  <div className="flex-1 min-h-0">
                    <SymbolDetailPanel
                      stock={chartVisible ? (selectedStock ?? null) : null}
                      headerStock={chartVisible ? (activeStock ?? null) : null}
                      refitNonce={refitNonce}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}
