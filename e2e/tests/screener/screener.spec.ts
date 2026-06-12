import { test, expect, type Page } from '@playwright/test'
import { navigateToPage, waitForPageHeading, resetTestConfig, API_BASE, TEST_USERNAME } from '../helpers'

/**
 * Mirror of frontend/src/hooks/useDebounce.ts SYMBOL_DEBOUNCE_MS.
 * The e2e project cannot import from the frontend source tree (no tsconfig path
 * aliases, different module system), so we define the constant here explicitly.
 * Keep in sync with the impl constant (currently 200 ms).
 */
const SYMBOL_DEBOUNCE_MS = 200

/** The screener page no longer renders a "Stock Screener" h1 (the header was
 *  removed), so readiness is signalled by the always-present filter section. */
async function waitForScreenerReady(page: Page) {
  // Generous timeout: the screener mounts the split chart pane + first-symbol
  // analyze on load, so under sustained dev-server load the always-present
  // "Filter Conditions" label can take longer than the 5s default to paint.
  await expect(page.getByText('Filter Conditions')).toBeVisible({ timeout: 20000 })
}

/**
 * The Filter Conditions section is COLLAPSED by default (so the results table +
 * chart are the first thing visible). Tests that assert or interact with filter
 * controls expand it first. Idempotent: a no-op when already expanded.
 */
async function expandScreenerFilter(page: Page) {
  const openBuilder = page.getByTestId('open-builder')
  if (await openBuilder.isVisible().catch(() => false)) return
  await page.getByRole('button', { name: /filter conditions/i }).first().click()
  await expect(openBuilder).toBeVisible()
}

/**
 * Wait for at least one screener result row to render. The old tests used fixed
 * `waitForTimeout(2000)` before grabbing rows, which flaked under load when the
 * live /stocks/filter (+ first-symbol analyze) hadn't settled in time. Gate on a
 * real data row instead so selection interactions are deterministic.
 */
async function waitForResultRow(page: Page) {
  await expect(page.locator('[data-symbol]').first()).toBeVisible({ timeout: 15000 })
}

/**
 * The chart pane defaults to COLLAPSED on load (results table full-width). Tests that
 * need the chart open click the "Chart" toggle and wait for the chart region. Idempotent.
 */
async function openChart(page: Page) {
  const toggle = page.getByRole('button', { name: 'Chart', exact: true })
  if ((await toggle.getAttribute('aria-pressed')) === 'true') return
  await toggle.click()
  await expect(page.getByRole('region', { name: 'Symbol detail chart' })).toBeVisible({ timeout: 10000 })
}

test.describe('Screener Page', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Screener')
    await waitForScreenerReady(page)
    await expandScreenerFilter(page)
  })

  test.describe('Page Structure', () => {
    test('does NOT show a page header — title / subtitle / clock were removed', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Stock Screener' })).toHaveCount(0)
      await expect(page.getByText('Filter and discover high-momentum stocks')).toHaveCount(0)
    })

    test('should display the Save ▾ control in the Current Filter card', async ({ page }) => {
      // The screener-header "Save Filter" button + dialog were replaced by a
      // provenance-aware "💾 Save ▾" popover on the Current Filter card.
      await expect(page.getByTestId('filter-save-menu')).toBeVisible()
    })

    test('does NOT display a live clock (the screener header was removed)', async ({ page }) => {
      await expect(page.getByText(/\d{2}:\d{2}:\d{2}\s+ICT/)).toHaveCount(0)
    })
  })

  test.describe('Filter Conditions', () => {
    test('should display filter conditions section', async ({ page }) => {
      await expect(page.getByText('Filter Conditions')).toBeVisible()
    })

    test('should display quick filter presets', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Momentum/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Breakout/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Trending Up/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Volume Surge/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Swing Trade/i })).toBeVisible()
    })

    test('should display exchange filter buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'All', exact: true }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: 'HOSE' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'HNX' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'UPCOM' })).toBeVisible()
    })

    test('should display Apply and Reset buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Apply/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Reset/i })).toBeVisible()
    })

    test('should show the Current Filter card with the editable formula box', async ({ page }) => {
      // The read-only preview + plain textarea merged into the single colored,
      // editable box inside the Current Filter card.
      await expect(page.getByTestId('current-filter')).toBeVisible()
      await expect(page.getByTestId('formula-box')).toBeVisible()
    })

    test('should have an Open builder button', async ({ page }) => {
      await expect(page.getByTestId('open-builder')).toBeVisible()
    })
  })

  test.describe('Exchange Filter', () => {
    test('should filter by HOSE exchange', async ({ page }) => {
      await page.getByRole('button', { name: 'HOSE' }).click()
      await page.getByRole('button', { name: /Apply/i }).click()

      await page.waitForTimeout(2000)
      const rows = page.locator('tbody tr')
      const count = await rows.count()
      if (count > 0) {
        const firstExchange = await rows.first().locator('td').nth(2).textContent()
        expect(firstExchange).toContain('HOSE')
      }
    })

    test('should reset to All exchanges', async ({ page }) => {
      await page.getByRole('button', { name: 'HOSE' }).click()
      await page.getByRole('button', { name: /Apply/i }).click()
      await page.waitForTimeout(1000)

      await page.getByRole('button', { name: 'All', exact: true }).first().click()
      await page.getByRole('button', { name: /Apply/i }).click()
      await page.waitForTimeout(1000)

      const results = page.getByText(/\d+ stocks/)
      await expect(results).toBeVisible()
    })
  })

  test.describe('Quick Presets', () => {
    test('should apply Momentum preset', async ({ page }) => {
      await page.getByRole('button', { name: /Momentum/i }).click()
      await page.waitForTimeout(500)

      // S5: presets seed the canonical tree, rendered in the formula box.
      const formula = page.getByTestId('formula-box')
      await expect(formula).toHaveValue(/RS 52W >= 80/)
      await expect(formula).toHaveValue(/Vol x SMA > 30/)
    })

    // Quick Filters now toggle like Saved Filter chips: re-clicking the ACTIVE one
    // un-selects it (resets to the empty / all-stocks filter).
    test('re-clicking the active Quick Filter toggles it off (all stocks)', async ({ page }) => {
      const momentum = page.getByRole('button', { name: /Momentum/i })
      const formula = page.getByTestId('formula-box')

      // First click selects it: chip pressed + formula seeded.
      await momentum.click()
      await expect(momentum).toHaveAttribute('aria-pressed', 'true')
      await expect(formula).toHaveValue(/RS 52W >= 80/)

      // Second click un-selects it: chip released + formula cleared (all stocks).
      await momentum.click()
      await expect(momentum).toHaveAttribute('aria-pressed', 'false')
      await expect(formula).toHaveValue('')
      await expect(page.getByTestId('current-filter-identity')).toContainText('Custom filter')
    })

    // Switching to a DIFFERENT Quick Filter loads it (does not toggle off).
    test('clicking a different Quick Filter switches to it', async ({ page }) => {
      await page.getByRole('button', { name: /Momentum/i }).click()
      await expect(page.getByRole('button', { name: /Momentum/i })).toHaveAttribute('aria-pressed', 'true')

      await page.getByRole('button', { name: /Breakout/i }).click()
      await expect(page.getByRole('button', { name: /Breakout/i })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByRole('button', { name: /Momentum/i })).toHaveAttribute('aria-pressed', 'false')
      await expect(page.getByTestId('formula-box')).toHaveValue(/RS 52W >= 70/)
    })
  })

  test.describe('Results Table', () => {
    test('should display results section', async ({ page }) => {
      await expect(page.getByText('Results')).toBeVisible()
    })

    test('should display stock count', async ({ page }) => {
      await expect(page.getByText(/\d+ stocks/)).toBeVisible()
    })

    test('should display table headers', async ({ page }) => {
      await page.waitForTimeout(1000)
      await expect(page.getByRole('columnheader', { name: 'Symbol' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Exchange' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'RS 52W' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Price' })).toBeVisible()
    })

    test('should display Export CSV button', async ({ page }) => {
      await expect(page.getByText(/Export CSV/i)).toBeVisible()
    })

    test('should show stocks in table', async ({ page }) => {
      await page.waitForTimeout(2000)
      const rows = page.locator('tbody tr')
      const count = await rows.count()
      expect(count).toBeGreaterThan(0)
    })

    // Regression: the rows are virtualized against the list-pane region. A nested
    // scroll container (the <Table> overflow-x-auto wrapper) used to hijack the
    // vertical scroll, so the region never scrolled and the virtual window froze at
    // the first ~23 rows — scrolling down showed blank space, no new symbols. The
    // region must BE the scroll container and the window must advance on scroll.
    test('scrolling the results advances the virtualized rows (no blank list)', async ({ page }) => {
      await waitForResultRow(page)
      const listRegion = page.getByRole('region', { name: 'Screener results' })

      // The region itself must own the vertical overflow.
      const canScroll = await listRegion.evaluate((el) => el.scrollHeight > el.clientHeight)
      expect(canScroll).toBe(true)

      // Symbol at the top of the initial (top) virtual window.
      const firstBefore = await listRegion
        .locator('tbody tr[data-symbol]')
        .first()
        .getAttribute('data-symbol')
      expect(firstBefore).toBeTruthy()

      // Scroll far down; the virtualizer must render a LATER slice of rows.
      await listRegion.evaluate((el) => {
        el.scrollTop = 9000
        el.dispatchEvent(new Event('scroll', { bubbles: true }))
      })

      // The first rendered symbol must change (the window advanced past the top).
      await expect
        .poll(
          () =>
            listRegion.locator('tbody tr[data-symbol]').first().getAttribute('data-symbol'),
          { timeout: 5000 }
        )
        .not.toBe(firstBefore)
    })

    test('should have select-all checkbox', async ({ page }) => {
      await waitForResultRow(page)
      // Checkboxes are themed Radix controls (role="checkbox"), not native inputs.
      const headerCheckbox = page.getByRole('checkbox', { name: 'Select all rows' })
      await expect(headerCheckbox).toBeVisible()
    })
  })

  test.describe('Stock Selection', () => {
    // Checkboxes are themed Radix controls (role="checkbox"), so we drive them via
    // getByRole(...).click() — the old `input[type="checkbox"]`/.check() never matched.
    test('should select individual stock', async ({ page }) => {
      await waitForResultRow(page)
      const firstCheckbox = page.locator('tbody tr').first().getByRole('checkbox')
      await firstCheckbox.click()
      await expect(firstCheckbox).toBeChecked()
    })

    test('should reveal the "Add to watchlist" action after selection', async ({ page }) => {
      await waitForResultRow(page)
      await page.locator('tbody tr').first().getByRole('checkbox').click()
      // The selection bar shows the count + the primary "Add to watchlist" action.
      await expect(page.getByText(/\d+ selected/)).toBeVisible()
      await expect(page.getByRole('button', { name: /Add to watchlist/i })).toBeVisible()
    })

    test('should select all stocks with header checkbox', async ({ page }) => {
      await waitForResultRow(page)
      const headerCheckbox = page.getByRole('checkbox', { name: 'Select all rows' })
      await headerCheckbox.click()

      const firstRowCheckbox = page.locator('tbody tr').first().getByRole('checkbox')
      await expect(firstRowCheckbox).toBeChecked()
    })
  })

  test.describe('Save ▾ (Current Filter)', () => {
    test('opens the save popover with "Save as new…"', async ({ page }) => {
      await page.getByTestId('filter-save-menu').click()
      await expect(page.getByTestId('filter-save-popover')).toBeVisible()
      await expect(page.getByTestId('filter-save-as-new')).toBeVisible()
    })

    test('saves the current query as a new preset', async ({ page }) => {
      await page.getByTestId('filter-save-menu').click()
      await page.getByTestId('filter-save-as-new').click()
      await page.getByTestId('filter-save-name').fill('E2E Test Filter')
      await page.getByTestId('filter-save-confirm').click()
      await expect(page.getByText(/Filter (saved|updated) successfully/)).toBeVisible({ timeout: 10000 })
    })
  })

  // ─── Provenance overhaul: "which filter is loaded?" ────────────────────────
  test.describe('Filter Provenance (overhaul)', () => {
    test('loading a built-in preset shows its name as the identity', async ({ page }) => {
      await page.getByRole('button', { name: /Momentum/i }).click()
      await expect(page.getByTestId('current-filter-identity')).toContainText('Momentum')
    })

    test('editing a loaded preset marks it modified + lights the Apply dot', async ({ page }) => {
      await page.getByRole('button', { name: /Momentum/i }).click()
      await expect(page.getByTestId('current-filter-identity')).toContainText('Momentum')

      // Edit the formula away from the preset.
      const formula = page.getByTestId('formula-box')
      await formula.click()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.press('Delete')
      await formula.fill('RS 52W >= 99')
      await page.waitForTimeout(300)

      // Provenance SURVIVES the edit: the name persists, now flagged "modified".
      await expect(page.getByTestId('current-filter-identity')).toContainText('Momentum')
      await expect(page.getByTestId('current-filter-identity')).toContainText('modified')
      // Free-text edits do not auto-apply → the unapplied-changes dot appears.
      await expect(page.getByTestId('apply-dirty-dot')).toBeVisible()
    })

    test('loading a preset while typing cancels the stale edit (no clobber)', async ({ page }) => {
      // Regression: type, then load a preset WITHIN the parse-debounce window. The
      // preset must win cleanly — no stale commit flipping it to "modified".
      const formula = page.getByTestId('formula-box')
      await formula.click()
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.press('Delete')
      await formula.fill('RS 52W >= 13') // arms the 150ms debounce
      await page.getByRole('button', { name: /Breakout/i }).click() // reseed within the window
      await page.waitForTimeout(400) // let any stale debounced commit fire

      await expect(formula).toHaveValue(/RS 52W >= 70/)
      await expect(formula).toHaveValue(/Vol x SMA > 80/)
      await expect(page.getByTestId('current-filter-identity')).toContainText('Breakout')
      await expect(page.getByTestId('current-filter-identity')).not.toContainText('modified')
    })

    test('the builder title reflects the loaded filter (the original complaint)', async ({ page }) => {
      await page.getByRole('button', { name: /Breakout/i }).click()
      await page.getByTestId('open-builder').click()
      await expect(page.getByTestId('query-builder-modal')).toBeVisible()
      await expect(page.getByTestId('builder-title')).toContainText('Breakout')
    })

    test('the filter header collapses and expands', async ({ page }) => {
      await expect(page.getByTestId('current-filter')).toBeVisible()
      await page.getByRole('button', { name: /Collapse filter conditions/i }).click()
      await expect(page.getByTestId('current-filter')).not.toBeVisible()
      await page.getByRole('button', { name: /Expand filter conditions/i }).click()
      await expect(page.getByTestId('current-filter')).toBeVisible()
    })
  })

  // The legacy "Add All → Add to Watchlist dialog (Bullish/Bearish options)" flow
  // was replaced by an inline selection action bar: selecting rows reveals a
  // "{n} selected" bar with "Clear" + "Add to watchlist". (The full add-to-watchlist
  // PUT payload is covered in watchlist-active.spec.ts.)
  test.describe('Selection action bar', () => {
    test('selecting a row reveals the action bar with Clear + Add to watchlist', async ({ page }) => {
      await waitForResultRow(page)
      await page.locator('tbody tr').first().getByRole('checkbox').click()
      await expect(page.getByText(/1 selected/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()
      await expect(page.getByRole('button', { name: /Add to watchlist/i })).toBeVisible()
    })

    test('Clear deselects and hides the action bar', async ({ page }) => {
      await waitForResultRow(page)
      await page.locator('tbody tr').first().getByRole('checkbox').click()
      await expect(page.getByText(/1 selected/)).toBeVisible()

      await page.getByRole('button', { name: 'Clear' }).click()
      await expect(page.getByText(/\d+ selected/)).toHaveCount(0)
    })
  })
})

// ─── Story 5: Symbol Detail Split ────────────────────────────────────────────
//
// Selectors used (all driven by data-* attributes set by the implementation):
//   [data-testid="chart-container"]   – PriceChart root, rendered by SymbolDetailPanel
//   [data-active="true"]              – the currently active TableRow (imperative DOM toggle)
//   [data-testid="screener-symbol-button"] – the symbol <button> inside each row
//   [data-symbol]                     – attribute on both rows and symbol buttons
//   role="region" + aria-label="Screener results"  – left list pane (focus owner)
//   role="region" + aria-label="Symbol detail chart" – right chart pane
//   aria-activedescendant             – set on the list region by applyActiveSymbol()
//   aria-pressed                      – on the Chart toggle button (collapses the pane)
//
// The SYMBOL_DEBOUNCE_MS constant (defined at the top of this file) mirrors
// frontend/src/hooks/useDebounce.ts so debounce-settle waits track the impl.

test.describe('Symbol Detail Split', () => {
  // Standard beforeEach: reset config and navigate to the Screener page.
  // All tests in this block run at 1280×800 (desktop) unless overridden.
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Screener')
    await waitForScreenerReady(page)
    await expandScreenerFilter(page)
  })

  // ── Helpers scoped to this describe block ──────────────────────────────────

  /** Wait for at least one data row to appear in the screener table. */
  async function waitForRows(page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never) {
    await expect(page.locator('[data-symbol]').first()).toBeVisible({ timeout: 15000 })
  }

  // ── default-charts-first-row (AC1.2) ──────────────────────────────────────
  //
  // After rows load the chart region must show the FIRST row's symbol by default:
  //   1. chart-container becomes visible within ~30 000 ms (analyze latency budget)
  //   2. the chart panel header text matches the first row's data-symbol
  test('default-charts-first-row', async ({ page }) => {
    // Wait for the table to have at least one row.
    await waitForRows(page)

    // The chart pane is COLLAPSED by default (toggle off, no chart region).
    await expect(page.getByRole('button', { name: 'Chart', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('region', { name: 'Symbol detail chart' })).toHaveCount(0)

    // Read the first row's symbol from its data-symbol attribute.
    const firstRow = page.locator('[data-symbol]').first()
    const firstSymbol = await firstRow.getAttribute('data-symbol')
    expect(firstSymbol).toBeTruthy()

    // Opening the chart charts the FIRST row's symbol by default.
    await openChart(page)

    // The chart-container must appear within the analyze-latency budget.
    const chart = page.locator('[data-testid="chart-container"]')
    await expect(chart).toBeVisible({ timeout: 30000 })

    // The chart panel header must show the first symbol. Scope to the header
    // testid: the sibling "N bars · SYM" subtitle ALSO contains the symbol, so a
    // bare region.getByText(symbol) becomes a strict-mode violation once it loads.
    await expect(page.getByTestId('symbol-detail-header')).toContainText(firstSymbol!, { timeout: 30000 })
  })

  // ── chart-fills-its-frame (new) ───────────────────────────────────────────
  //
  // The chart used to be a fixed ~500px height inside a taller pane, leaving a big
  // empty gap below it. With RSI off (the default) the chart now fills its pane:
  // its container's bottom reaches the chart region's bottom within a small chrome
  // budget (the legend), so there is no large fixed-height empty gap.
  test('chart-fills-its-frame', async ({ page }) => {
    await waitForRows(page)
    await openChart(page)
    const container = page.locator('[data-testid="chart-container"]')
    await expect(container).toBeVisible({ timeout: 30000 })

    const gap = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="chart-container"]')
      const region = document.querySelector('[aria-label="Symbol detail chart"]')
      if (!c || !region) return -1
      return Math.round(region.getBoundingClientRect().bottom - c.getBoundingClientRect().bottom)
    })
    // Only the legend (+ its top margin) sits below the chart container — a small,
    // viewport-independent budget. A regression to the old fixed height would leave a
    // much larger gap that grows with viewport height.
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(48)
  })

  // ── both-panes-visible (AC1.2) ────────────────────────────────────────────
  //
  // At desktop width (1280 px — the Playwright default) the results table AND
  // the chart region must be simultaneously visible with no overlay.
  test('both-panes-visible', async ({ page }) => {
    await waitForRows(page)
    await openChart(page)

    const listRegion = page.getByRole('region', { name: 'Screener results' })
    const chartRegion = page.getByRole('region', { name: 'Symbol detail chart' })

    await expect(listRegion).toBeVisible()
    await expect(chartRegion).toBeVisible()

    // Verify side-by-side: list region left edge must be to the LEFT of the chart
    // region left edge (no overlap / overlay).
    const listBox = await listRegion.boundingBox()
    const chartBox = await chartRegion.boundingBox()
    expect(listBox).not.toBeNull()
    expect(chartBox).not.toBeNull()
    expect(listBox!.x).toBeLessThan(chartBox!.x)
  })

  // ── click-row-recharts (AC4.2) ────────────────────────────────────────────
  //
  // Clicking a DIFFERENT row's symbol button must move [data-active="true"] to
  // that row AND update the chart panel header to reflect the clicked symbol.
  test('click-row-recharts', async ({ page }) => {
    await waitForRows(page)

    // Collect the first two distinct symbol rows.
    const symbolButtons = page.locator('[data-testid="screener-symbol-button"]')
    await expect(symbolButtons.nth(1)).toBeVisible({ timeout: 10000 })

    // Read the second row's symbol.
    const secondSymbol = await symbolButtons.nth(1).getAttribute('data-symbol')
    expect(secondSymbol).toBeTruthy()

    // Click the second row's symbol button.
    await symbolButtons.nth(1).click()

    // The active-row marker must move to the second row.
    const activeRow = page.locator('[data-active="true"]')
    await expect(activeRow).toHaveAttribute('data-symbol', secondSymbol!, { timeout: 5000 })

    // The chart panel header must show the clicked symbol (instant, from headerStock).
    // Scope to the header testid (the "N bars · SYM" subtitle also carries the symbol).
    await expect(page.getByTestId('symbol-detail-header')).toContainText(secondSymbol!, { timeout: 5000 })
  })

  // ── arrow-nav-recharts (AC4a.2) ───────────────────────────────────────────
  //
  // Focus the list region, press ArrowDown then ArrowUp:
  //   - [data-active="true"] must update on each press
  //   - aria-activedescendant on the region must update accordingly
  //   - keys must not move page scroll / focus outside the list region
  test('arrow-nav-recharts', async ({ page }) => {
    await waitForRows(page)

    // Wait for the initial active row.
    const activeRow = page.locator('[data-active="true"]')
    await expect(activeRow).toBeVisible({ timeout: 10000 })
    const initialSymbol = await activeRow.getAttribute('data-symbol')
    expect(initialSymbol).toBeTruthy()

    // Focus the list region.
    const listRegion = page.getByRole('region', { name: 'Screener results' })
    await listRegion.focus()

    // ArrowDown — active symbol must change to the NEXT row.
    await page.keyboard.press('ArrowDown')
    const afterDown = page.locator('[data-active="true"]')
    await expect(afterDown).not.toHaveAttribute('data-symbol', initialSymbol!, { timeout: 3000 })
    const downSymbol = await afterDown.getAttribute('data-symbol')
    expect(downSymbol).toBeTruthy()

    // aria-activedescendant must reference the new active row id (screener-row-<symbol>).
    await expect(listRegion).toHaveAttribute('aria-activedescendant', `screener-row-${downSymbol}`)

    // ArrowUp — active symbol must go back to the initial row.
    await page.keyboard.press('ArrowUp')
    const afterUp = page.locator('[data-active="true"]')
    await expect(afterUp).toHaveAttribute('data-symbol', initialSymbol!, { timeout: 3000 })
    await expect(listRegion).toHaveAttribute('aria-activedescendant', `screener-row-${initialSymbol}`)
  })

  // ── keyboard-multiselect (AC4a Space/Enter, C2/R6) ────────────────────────
  //
  // Focus the list region → ArrowDown → Space → active row checkbox is CHECKED
  // and "Add to watchlist" appears. Then Enter → chart panel header reflects the
  // active row's symbol.
  test('keyboard-multiselect', async ({ page }) => {
    await waitForRows(page)

    // Wait for initial active row.
    await expect(page.locator('[data-active="true"]')).toBeVisible({ timeout: 10000 })

    // Focus the list region and arrow-down to the second row.
    const listRegion = page.getByRole('region', { name: 'Screener results' })
    await listRegion.focus()
    await page.keyboard.press('ArrowDown')

    // Read the active symbol after the move.
    const activeRow = page.locator('[data-active="true"]')
    await expect(activeRow).toBeVisible({ timeout: 3000 })
    const activeSymbol = await activeRow.getAttribute('data-symbol')
    expect(activeSymbol).toBeTruthy()

    // Space → toggle the active row's checkbox.
    await page.keyboard.press('Space')

    // The active row's checkbox must be checked.
    const activeCheckbox = activeRow.getByRole('checkbox')
    await expect(activeCheckbox).toBeChecked({ timeout: 3000 })

    // "Add to watchlist" button must appear (reuses existing pattern from screener.spec.ts:152).
    await expect(page.getByRole('button', { name: /Add to watchlist/i })).toBeVisible({ timeout: 3000 })

    // Enter → confirm the active symbol is charted (header updates).
    await listRegion.focus()
    await page.keyboard.press('Enter')

    await expect(page.getByTestId('symbol-detail-header')).toContainText(activeSymbol!, { timeout: 5000 })
  })

  // ── checkbox-isolation (AC4.2) ────────────────────────────────────────────
  //
  // Part A: checking row-0's checkbox does NOT change [data-active="true"] or
  //         the charted symbol; the checkbox IS checked and "Add to watchlist" appears.
  // Part B: clicking the ROW (not checkbox) does NOT toggle the checkbox.
  test('checkbox-isolation', async ({ page }) => {
    await waitForRows(page)

    // Wait for the initial active (first) row.
    const activeRow = page.locator('[data-active="true"]')
    await expect(activeRow).toBeVisible({ timeout: 10000 })
    const initialActiveSymbol = await activeRow.getAttribute('data-symbol')
    expect(initialActiveSymbol).toBeTruthy()

    // ── Part A: check row-0's checkbox ────────────────────────────────────
    const rows = page.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 5000 })
    const row0Checkbox = rows.first().getByRole('checkbox')
    await row0Checkbox.click()

    // Checkbox must be checked.
    await expect(row0Checkbox).toBeChecked()

    // "Add to watchlist" must appear.
    await expect(page.getByRole('button', { name: /Add to watchlist/i })).toBeVisible()

    // The active row must NOT have changed — still the same symbol.
    const stillActive = page.locator('[data-active="true"]')
    await expect(stillActive).toHaveAttribute('data-symbol', initialActiveSymbol!)

    // ── Part B: click a different row body (not its checkbox) → does not toggle checkbox ─
    // Navigate to a row that is NOT currently active to make the click meaningful.
    const symbolButtons = page.locator('[data-testid="screener-symbol-button"]')
    await expect(symbolButtons.nth(1)).toBeVisible({ timeout: 5000 })
    const secondSymbol = await symbolButtons.nth(1).getAttribute('data-symbol')
    expect(secondSymbol).toBeTruthy()

    // Row-1's checkbox must be unchecked before we click.
    const row1Checkbox = rows.nth(1).getByRole('checkbox')
    await expect(row1Checkbox).not.toBeChecked()

    // Click the row (via symbol button, which is part of the row) — this charts it.
    await symbolButtons.nth(1).click()

    // The row-1 checkbox must STILL be unchecked — row click must not toggle it.
    await expect(row1Checkbox).not.toBeChecked()

    // The active symbol must now be row-1.
    await expect(page.locator('[data-active="true"]')).toHaveAttribute('data-symbol', secondSymbol!, { timeout: 3000 })
  })

  // ── collapse-hides-reveals-column (AC4.5) ─────────────────────────────────
  //
  // Clicking the chart toggle (» or the Chart button) must:
  //   1. hide chart-container
  //   2. reveal at least one of the extra columns (RS 1M / RS 3M / Vol/SMA)
  //      that were hidden while the chart was visible
  test('collapse-hides-reveals-column', async ({ page }) => {
    await waitForRows(page)
    await openChart(page)

    // The chart must be visible initially.
    const chart = page.locator('[data-testid="chart-container"]')
    await expect(chart).toBeVisible({ timeout: 30000 })

    // The chart region must be present — use it to confirm collapse hides it.
    const chartRegion = page.getByRole('region', { name: 'Symbol detail chart' })
    await expect(chartRegion).toBeVisible()

    // Collapse via the "Chart" toggle in the results toolbar (the in-pane "»" hide
    // icon was removed as redundant).
    await page.getByRole('button', { name: 'Chart', exact: true }).click()

    // chart-container must no longer be visible.
    await expect(chart).not.toBeVisible({ timeout: 5000 })

    // chart region itself must disappear (the conditional rendering removes it).
    await expect(chartRegion).not.toBeVisible({ timeout: 5000 })

    // At least one of the extra columns (RS 1M / RS 3M / Vol/SMA) must now be visible.
    // showExtraColumns=true causes these to render regardless of visibleColumns config.
    const extraColumnVisible = await Promise.any([
      expect(page.getByRole('columnheader', { name: 'RS 1M' })).toBeVisible({ timeout: 3000 }),
      expect(page.getByRole('columnheader', { name: 'RS 3M' })).toBeVisible({ timeout: 3000 }),
      expect(page.getByRole('columnheader', { name: 'Vol/SMA' })).toBeVisible({ timeout: 3000 }),
    ]).then(() => true).catch(() => false)
    expect(extraColumnVisible).toBe(true)
  })

  // ── refilter-resets-selection (AC4.4) ─────────────────────────────────────
  //
  // After a refetch (Apply / exchange change) the active selection re-defaults to
  // the new first row. A search yielding ZERO rows → [data-active] is absent and
  // chart-container is not visible.
  test('refilter-resets-selection', async ({ page }) => {
    await waitForRows(page)
    await openChart(page)

    // Wait for an initial active row to exist.
    await expect(page.locator('[data-active="true"]')).toBeVisible({ timeout: 10000 })

    // ── Part 1: trigger a refetch by clicking Apply ────────────────────────
    await page.getByRole('button', { name: /Apply/i }).click()

    // After refetch the active row must re-default to the first row.
    await expect(page.locator('[data-active="true"]')).toBeVisible({ timeout: 15000 })

    // ── Part 2: search yielding zero rows ─────────────────────────────────
    // Type a search string that cannot match any symbol (gibberish).
    const searchInput = page.getByPlaceholder(/Search symbol/i)
    await searchInput.fill('ZZZNOMATCH999')

    // Wait for the zero-rows state (the displayStocks effect fires synchronously).
    await expect(page.locator('[data-active]')).toHaveCount(0, { timeout: 5000 })

    // chart-container must not be visible (enabled gate: stock is null → no mount).
    await expect(page.locator('[data-testid="chart-container"]')).not.toBeVisible({ timeout: 5000 })

    // Clear the search and verify the active row comes back.
    await searchInput.fill('')
    await expect(page.locator('[data-active="true"]')).toBeVisible({ timeout: 10000 })
  })

  // ── narrow-viewport (AC1.3) ───────────────────────────────────────────────
  //
  // At 900 px width the matchMedia('(max-width: 1023px)') listener fires and sets
  // chartVisible=false, which:
  //   1. hides/stacks the chart pane (the chart region is not rendered)
  //   2. suppresses the /analyze/ fetch entirely (enabled gate is false)
  //
  // The viewport must be set BEFORE navigation so the matchMedia evaluates on mount.
  test('narrow-viewport', async ({ page }) => {
    // Track /analyze/ requests — register BEFORE navigation.
    let analyzeCalls = 0
    page.on('request', (req) => {
      if (req.url().includes('/analyze/')) analyzeCalls++
    })

    // Set narrow viewport BEFORE navigating (matchMedia must fire on mount).
    await page.setViewportSize({ width: 900, height: 800 })

    await resetTestConfig()
    await navigateToPage(page, 'Screener')
    await waitForScreenerReady(page)
    await waitForRows(page)

    // The chart region must NOT be visible at narrow width.
    const chartRegion = page.getByRole('region', { name: 'Symbol detail chart' })
    await expect(chartRegion).not.toBeVisible({ timeout: 5000 })

    // The chart-container must not be visible.
    await expect(page.locator('[data-testid="chart-container"]')).not.toBeVisible()

    // No /analyze/ calls must have fired (enabled=false suppresses the fetch).
    // Give the page a moment to settle before polling.
    await expect.poll(() => analyzeCalls, { timeout: 8000 }).toBe(0)
  })

  // ── enabled-gate (AC2.2) ──────────────────────────────────────────────────
  //
  // Exactly ONE /analyze/ fires for the default first symbol on load (chart
  // visible + rows exist). After one deliberate row selection a SECOND /analyze/
  // fires (debounced by SYMBOL_DEBOUNCE_MS + margin).
  //
  // Uses expect.poll throughout — NEVER synchronous equality on the counter.
  test('enabled-gate', async ({ page }) => {
    // Register the request counter BEFORE navigation.
    let analyzeCalls = 0
    page.on('request', (req) => {
      if (req.url().includes('/analyze/')) analyzeCalls++
    })

    // Navigate (beforeEach already ran; re-navigate with counter already wired).
    // The beforeEach navigated before we wired the counter, so we navigate again
    // directly here for accurate counting.
    await resetTestConfig()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const nav = page.locator('nav')
    await nav.getByRole('link', { name: 'Screener' }).click()
    await waitForScreenerReady(page)
    await waitForRows(page)

    // Chart pane is COLLAPSED by default → NO analyze fires on load (enabled gate).
    await page.waitForTimeout(1000)
    await expect.poll(() => analyzeCalls, { timeout: 5000 }).toBe(0)

    // Opening the chart fires exactly ONE /analyze/ for the default first symbol.
    await openChart(page)
    await expect.poll(() => analyzeCalls, { timeout: 30000 }).toBe(1)

    // Wait for the second symbol button to be available.
    const symbolButtons = page.locator('[data-testid="screener-symbol-button"]')
    await expect(symbolButtons.nth(1)).toBeVisible({ timeout: 10000 })

    // Click the second row to trigger a new selection.
    await symbolButtons.nth(1).click()

    // Wait for SYMBOL_DEBOUNCE_MS + margin to let the debounce settle.
    await page.waitForTimeout(SYMBOL_DEBOUNCE_MS + 150)

    // Exactly ONE additional /analyze/ call must have fired (total = 2).
    await expect.poll(() => analyzeCalls, { timeout: 10000 }).toBe(2)
  })
})

// ─── Story 6: Query Builder POP-UP ───────────────────────────────────────────
//
// The Query Builder is a MODAL over the dimmed screener (the screener stays
// mounted behind a backdrop). Selectors are driven by data-testid attributes set
// by the implementation:
//   [data-testid="open-builder"]            – the "⚙ Open builder" trigger in FilterBar
//   [data-testid="query-builder-modal"]     – the modal shell (role=dialog, aria-modal)
//   [data-testid="builder-done"]            – "✓ Done · view results"
//   [data-testid="builder-cancel"]          – "Cancel"
//   [data-testid="builder-preview"]         – live prettyFormula(root) preview
//   [data-testid="filter-group"]            – a recursive group; carries data-depth
//   [data-testid="add-metrics"]             – "+ Add metrics" (per group)
//   [data-testid="add-group"]               – "+ Group" (per group)
//   [data-testid="condition-row"]           – an inline-editable leaf row (draggable)
//   [data-testid="metric-picker"]           – the multi-select metric popup
//   [data-testid="metric-picker-done"]      – the popup "Done · add N" button
//   [data-testid="metric-picker-remaining"] – the "N remaining" cap hint
//   [data-testid="move-menu-trigger"]       – the non-DnD "Move to group…" trigger
//   [data-testid="cap-hint-depth"]          – "· max depth (3)" message
//   [data-field="<field>"]                  – on metric-picker items AND condition rows

test.describe('Query Builder (S6)', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Screener')
    await waitForScreenerReady(page)
    await expandScreenerFilter(page)
  })

  /** Open the builder pop-up and wait for the modal shell. */
  async function openBuilder(page: Page) {
    await page.getByTestId('open-builder').click()
    await expect(page.getByTestId('query-builder-modal')).toBeVisible()
  }

  // The screener now opens with an EMPTY default filter (getDefaultTree =
  // makeBranch('and', [])), so tests that need a starting leaf seed it explicitly
  // via the metric picker (this used to be a default-seeded rs_52w row).
  async function addLeaf(page: Page, field: string) {
    await page.getByTestId('add-metrics').first().click()
    const picker = page.getByTestId('metric-picker')
    await expect(picker).toBeVisible()
    await picker.locator(`[data-field="${field}"]`).click()
    await page.getByTestId('metric-picker-done').click()
    await expect(picker).not.toBeVisible()
  }

  // ── builder add and edit (AC2) ─────────────────────────────────────────────
  test('builder add and edit', async ({ page }) => {
    await openBuilder(page)
    await addLeaf(page, 'rs_52w') // seed the leaf the empty default no longer provides

    // Open the metric picker on the root group and pick 3 metrics.
    await page.getByTestId('add-metrics').first().click()
    const picker = page.getByTestId('metric-picker')
    await expect(picker).toBeVisible()

    await picker.locator('[data-field="rs_3m"]').click()
    await picker.locator('[data-field="rs_6m"]').click()
    await picker.locator('[data-field="rs_9m"]').click()

    const done = page.getByTestId('metric-picker-done')
    await expect(done).toHaveText(/add 3/i)
    await done.click()

    // 3 new rows added on top of the seeded rs_52w leaf → at least 4 rows.
    const rows = page.getByTestId('condition-row')
    await expect(rows).toHaveCount(4)

    // Inline-edit a numeric value and confirm the live preview reflects it.
    const rs3mRow = page.locator('[data-testid="condition-row"][data-field="rs_3m"]')
    const valueInput = rs3mRow.getByRole('spinbutton')
    await valueInput.fill('85')
    await expect(page.getByTestId('builder-preview')).toContainText('RS 3M >= 85')
  })

  // ── drag condition between groups (AC3) ────────────────────────────────────
  test('drag condition between groups', async ({ page }) => {
    await openBuilder(page)
    await addLeaf(page, 'rs_52w') // seed the leaf the empty default no longer provides

    // Create a nested group so there are two drop targets.
    await page.getByTestId('add-group').first().click()
    await expect(page.getByTestId('filter-group')).toHaveCount(2)

    // The seeded rs_52w leaf lives in the root group.
    const sourceRow = page.locator('[data-testid="condition-row"][data-field="rs_52w"]')
    await expect(sourceRow).toBeVisible()

    // The nested (child) group is the second filter-group.
    const childGroup = page.getByTestId('filter-group').nth(1)

    // HTML5 drag-and-drop via Playwright.
    await sourceRow.dragTo(childGroup)

    // After the move the rs_52w row must now be a descendant of the child group.
    await expect(childGroup.locator('[data-testid="condition-row"][data-field="rs_52w"]')).toBeVisible()
  })

  // ── builder caps (AC4) ─────────────────────────────────────────────────────
  test('builder caps', async ({ page }) => {
    await openBuilder(page)

    // Root group is data-depth=1.
    const root = page.getByTestId('filter-group').first()
    await expect(root).toHaveAttribute('data-depth', '1')

    // Add a level-2 group, then a level-3 group → "+ Group" must disable at depth 3.
    await root.getByTestId('add-group').click()
    const lvl2 = page.getByTestId('filter-group').nth(1)
    await expect(lvl2).toHaveAttribute('data-depth', '2')

    await lvl2.getByTestId('add-group').click()
    const lvl3 = page.getByTestId('filter-group').nth(2)
    await expect(lvl3).toHaveAttribute('data-depth', '3')

    // At depth 3 the "+ Group" button is disabled and a max-depth hint shows.
    await expect(lvl3.getByTestId('add-group')).toBeDisabled()
    await expect(lvl3.getByTestId('cap-hint-depth')).toBeVisible()

    // Deterministic distinct depths across nesting levels.
    await expect(page.getByTestId('filter-group').nth(0)).toHaveAttribute('data-depth', '1')
    await expect(page.getByTestId('filter-group').nth(1)).toHaveAttribute('data-depth', '2')
    await expect(page.getByTestId('filter-group').nth(2)).toHaveAttribute('data-depth', '3')
  })

  // ── builder popup modal (AC5) ──────────────────────────────────────────────
  test('builder popup modal', async ({ page }) => {
    // Screener is ready before opening the builder.
    await waitForScreenerReady(page)

    await openBuilder(page)

    // The modal is a dialog over the still-mounted screener (filter section remains in DOM).
    const modal = page.getByTestId('query-builder-modal')
    await expect(modal).toHaveAttribute('aria-modal', 'true')
    await expect(page.getByText('Filter Conditions')).toBeAttached()

    // Cancel closes the modal.
    await page.getByTestId('builder-cancel').click()
    await expect(modal).not.toBeVisible()

    // Re-open and close via backdrop click (click the modal shell's outer area).
    await openBuilder(page)
    // Click the top-left corner of the backdrop (outside the inner shell).
    await page.getByTestId('query-builder-modal').click({ position: { x: 5, y: 5 } })
    await expect(page.getByTestId('query-builder-modal')).not.toBeVisible()

    // Re-open and apply via Done.
    await openBuilder(page)
    await page.getByTestId('builder-done').click()
    await expect(page.getByTestId('query-builder-modal')).not.toBeVisible()
  })

  // ── bulk add cap clamp (AC6 / M2) ──────────────────────────────────────────
  //
  // Drive the tree to exactly 48 leaves, then open the picker: it must let the
  // user check only 2 more ("2 remaining"), and "Done" must add EXACTLY 2,
  // never overshooting the global 50-cap.
  test('bulk add cap clamp', async ({ page }) => {
    await openBuilder(page)

    /** Open the picker, check up to `want` ENABLED items, Done. Returns added. */
    async function addN(page2: Page, want: number): Promise<void> {
      await page2.getByTestId('add-metrics').first().click()
      const picker = page2.getByTestId('metric-picker')
      await expect(picker).toBeVisible()
      const items = picker.locator('[data-field]')
      const total = await items.count()
      let checked = 0
      for (let i = 0; i < total && checked < want; i++) {
        const it = items.nth(i)
        if (await it.isEnabled()) {
          await it.click()
          checked++
        }
      }
      await page2.getByTestId('metric-picker-done').click()
      await expect(picker).not.toBeVisible()
    }

    // Seed 1 leaf (the empty default provides none), then 19 + 19 + 9 = 47 → total 48 leaves.
    await addLeaf(page, 'rs_52w')
    await addN(page, 19)
    await addN(page, 19)
    await addN(page, 9)
    await expect(page.getByTestId('condition-row')).toHaveCount(48)

    // Open the picker at 48 leaves: remaining capacity = 2.
    await page.getByTestId('add-metrics').first().click()
    const picker = page.getByTestId('metric-picker')
    await expect(picker).toBeVisible()
    await expect(page.getByTestId('metric-picker-remaining')).toContainText('2 remaining')

    // Try to check 5 metrics — only 2 may be checked; the rest disable.
    const items = picker.locator('[data-field]')
    for (let i = 0; i < 5; i++) {
      const it = items.nth(i)
      if (await it.isEnabled()) await it.click()
    }
    // Done reflects exactly 2 selected (the clamp held).
    await expect(page.getByTestId('metric-picker-done')).toHaveText(/add 2/i)
    await page.getByTestId('metric-picker-done').click()

    // Total never exceeds 50.
    await expect(page.getByTestId('condition-row')).toHaveCount(50)
  })

  // ── move to group menu (AC7 / M5) ──────────────────────────────────────────
  test('move to group menu', async ({ page }) => {
    await openBuilder(page)
    await addLeaf(page, 'rs_52w') // seed the leaf the empty default no longer provides

    // Make a second group so a "Move to group…" target exists.
    await page.getByTestId('add-group').first().click()
    await expect(page.getByTestId('filter-group')).toHaveCount(2)

    const sourceRow = page.locator('[data-testid="condition-row"][data-field="rs_52w"]')
    await expect(sourceRow).toBeVisible()

    // Open the non-DnD move menu and pick the (only) other group.
    await sourceRow.getByTestId('move-menu-trigger').click()
    const menu = page.getByTestId('move-menu')
    await expect(menu).toBeVisible()
    await menu.getByTestId('move-menu-item').first().click()

    // The condition must now live in the child group (data-depth=2).
    const childGroup = page.getByTestId('filter-group').nth(1)
    await expect(childGroup.locator('[data-testid="condition-row"][data-field="rs_52w"]')).toBeVisible()
  })
})

// ─── Story 6 (R6): Config preset reuses the Query Builder ────────────────────

test.describe('Config Metrics Filter Presets (S6/R6)', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Config')
    await waitForPageHeading(page, 'Trading Configuration')
  })

  // ── config preset query builder (AC8) ──────────────────────────────────────
  //
  // The config-page saved-preset editor opens the SAME Query Builder pop-up and
  // saves/loads {root}. Add a preset via the builder, confirm it renders as a
  // tree formula on the preset card.
  test('config preset query builder', async ({ page }) => {
    // "Add Preset" opens the shared Query Builder pop-up (with a name field).
    // (.first(): the EmptyState renders its own "Add Preset" when no presets exist.)
    await page.getByRole('button', { name: /Add Preset/i }).first().click()
    const modal = page.getByTestId('query-builder-modal')
    await expect(modal).toBeVisible()

    // The builder name field (R6 withName) must be present.
    await page.getByTestId('builder-preset-name').fill('E2E Builder Preset')

    // Add a couple of metrics via the same multi-select picker.
    await page.getByTestId('add-metrics').first().click()
    const picker = page.getByTestId('metric-picker')
    await expect(picker).toBeVisible()
    await picker.locator('[data-field="rs_3m"]').click()
    await page.getByTestId('metric-picker-done').click()

    // The live preview reflects the tree (proves it edits {root}, not flat).
    await expect(page.getByTestId('builder-preview')).toContainText('RS 3M')

    // Save the preset (Done).
    await page.getByTestId('builder-done').click()
    await expect(modal).not.toBeVisible()

    // The preset card renders the tree as a pretty formula (no flat pills).
    // Cards are collapsed by default — expand it first to reveal the formula.
    // The config-page builder starts EMPTY (it does NOT seed an RS 52W leaf, unlike
    // the screener builder), so the saved preset contains only the rs_3m we added.
    await expect(page.getByText('E2E Builder Preset').first()).toBeVisible()
    await page.getByText('E2E Builder Preset').first().click()
    const presetFormula = page.getByTestId('preset-formula').first()
    await expect(presetFormula).toContainText('RS 3M')
  })
})

// ─── Story 5: Screener editable formula box ──────────────────────────────────
//
// The flat "Active Filters" editor is replaced by an editable, pretty-printed,
// multi-line formula textarea. Debounced oninput → parseFormula → on success
// commit the tree + re-filter; on parse error show an inline ✗ and KEEP the last
// valid filter; empty box shows an explicit "no filter — all stocks" hint;
// oversized paste is truncated with an inline notice. "⚙ Open builder" stays
// reachable even while the box is in the ✗ state.
//
// Selectors (data-testid set by FilterBar.tsx):
//   [data-testid="formula-box"]          – the editable <textarea>
//   [data-testid="formula-status"]       – the ✓ / ✗ / hint status line
//   [data-testid="formula-cap-notice"]   – the oversized-input truncation notice
//   [data-testid="open-builder"]         – "⚙ Open builder" trigger
//   [data-testid="query-builder-modal"]  – the builder pop-up shell

test.describe('Screener Formula Box (S5)', () => {
  // Upper bound for ColoredFormulaEditor's PARSE_DEBOUNCE_MS (currently 150ms).
  // The e2e project cannot import from the frontend source tree, so we duplicate a
  // safe over-wait here; keep ≥ the impl constant.
  const PARSE_DEBOUNCE_MS = 220

  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Screener')
    await waitForScreenerReady(page)
    await expandScreenerFilter(page)
  })

  /** Replace the whole formula text (select-all + type) and let the debounce settle. */
  async function setFormula(page: Page, text: string) {
    const ta = page.getByTestId('formula-box')
    await ta.click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Delete')
    if (text) await ta.fill(text)
    // `fill` replaces the value; dispatch input is implicit. Wait out the debounce.
    await page.waitForTimeout(PARSE_DEBOUNCE_MS + 120)
  }

  // ── formula edit ───────────────────────────────────────────────────────────
  //
  // Editing the formula text re-filters results; a preset re-seeds the box in the
  // SAME inline format FilterFormula uses (same-level conditions on one line).
  test('formula edit', async ({ page }) => {
    const formula = page.getByTestId('formula-box')
    await expect(formula).toBeVisible()

    // Edit to a valid nested query → status becomes valid and Apply re-filters.
    await setFormula(
      page,
      'RS 52W >= 70 AND (Breakout confirmed = Yes OR Bullish RSI = Yes)'
    )
    await expect(page.getByTestId('formula-status')).toContainText('valid')
    await page.getByRole('button', { name: /Apply/i }).click()
    await expect(page.getByText(/\d+ stocks/)).toBeVisible({ timeout: 15000 })

    // A FLAT preset re-seeds inline on ONE line (same-level conditions joined by
    // AND) — the same layout the config preset card / builder preview render.
    await page.getByRole('button', { name: /Momentum/i }).click()
    const value = await formula.inputValue()
    expect(value.split('\n')).toHaveLength(1)
    expect(value).toContain('RS 52W >= 80 AND')
    expect(value).toContain('Vol x SMA > 30')
  })

  // ── format consistency: screener box == builder preview (the user request) ───
  //
  // The screener editable box and the Query Builder live preview must render the
  // SAME format/content — both derive from formulaSegments. Load a preset so the
  // box shows the canonical formatted text, then compare it (whitespace-stripped)
  // to the builder preview's text.
  test('screener formula matches the builder preview format', async ({ page }) => {
    await page.getByRole('button', { name: /Momentum/i }).click()
    const boxValue = await page.getByTestId('formula-box').inputValue()

    await page.getByTestId('open-builder').click()
    await expect(page.getByTestId('query-builder-modal')).toBeVisible()
    const previewText = (await page.getByTestId('builder-preview').textContent()) ?? ''

    const strip = (s: string) => s.replace(/\s+/g, '')
    expect(strip(boxValue).length).toBeGreaterThan(0)
    expect(strip(boxValue)).toBe(strip(previewText))
  })

  // ── open builder round-trip ──────────────────────────────────────────────────
  //
  // Open builder → the modal seeds from the current formula; edit + Done closes it
  // and the screener formula reflects the change.
  test('open builder round-trip', async ({ page }) => {
    await setFormula(page, 'RS 52W >= 70')

    // Open the builder pop-up; it seeds from the formula tree.
    await page.getByTestId('open-builder').click()
    const modal = page.getByTestId('query-builder-modal')
    await expect(modal).toBeVisible()

    // Add a metric via the picker so the tree changes.
    await page.getByTestId('add-metrics').first().click()
    const picker = page.getByTestId('metric-picker')
    await expect(picker).toBeVisible()
    await picker.locator('[data-field="rs_3m"]').click()
    await page.getByTestId('metric-picker-done').click()

    // Apply via Done → modal closes and the screener formula reflects the new leaf.
    await page.getByTestId('builder-done').click()
    await expect(modal).not.toBeVisible()

    const formula = page.getByTestId('formula-box')
    await expect(formula).toHaveValue(/RS 52W >= 70/)
    await expect(formula).toHaveValue(/RS 3M/)
  })

  // ── open builder reachable on error (AC4 / C1-F2) ────────────────────────────
  //
  // With the formula box in the ✗ (unparseable) state, "⚙ Open builder" is still
  // present AND opens a functional Query Builder pop-up — the parser-free editor
  // is never unreachable.
  test('open builder reachable on error', async ({ page }) => {
    // Type a clearly invalid query → inline ✗ status.
    await setFormula(page, 'RS 52W >= AND OR (((')
    await expect(page.getByTestId('formula-status')).toContainText('✗')

    // The Open builder control is still present and clickable.
    const openBuilder = page.getByTestId('open-builder')
    await expect(openBuilder).toBeVisible()
    await expect(openBuilder).toBeEnabled()
    await openBuilder.click()

    // A functional builder pop-up opens (its preview + add-metrics work).
    const modal = page.getByTestId('query-builder-modal')
    await expect(modal).toBeVisible()
    await expect(page.getByTestId('builder-preview')).toBeVisible()
    await page.getByTestId('add-metrics').first().click()
    await expect(page.getByTestId('metric-picker')).toBeVisible()
  })

  // ── empty formula hint (AC5) ─────────────────────────────────────────────────
  //
  // Clearing the box shows an explicit "no filter — all stocks" hint (NOT a silent
  // return-all); applying returns all stocks with the hint visible.
  test('empty formula hint', async ({ page }) => {
    await setFormula(page, '')

    // Explicit hint — never a silent return-all.
    await expect(page.getByTestId('formula-status')).toContainText('no filter — all stocks')

    // Applying returns the full set; the hint remains visible.
    await page.getByRole('button', { name: /Apply/i }).click()
    await expect(page.getByText(/\d+ stocks/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('formula-status')).toContainText('no filter — all stocks')
  })

  // ── formula input cap (AC6) ──────────────────────────────────────────────────
  //
  // Pasting an oversized string is truncated with an inline notice and never hangs.
  test('formula input cap', async ({ page }) => {
    const formula = page.getByTestId('formula-box')
    await expect(formula).toBeVisible()

    // 256 KiB cap mirrors the backend MaxBytesReader. Build a string just over it.
    const CAP = 256 * 1024
    const oversized = 'A'.repeat(CAP + 500)

    // `fill` sets the value then dispatches input → the handler truncates.
    await formula.fill(oversized)
    await page.waitForTimeout(PARSE_DEBOUNCE_MS + 120)

    // The inline truncation notice appears and the value is clamped to the cap.
    await expect(page.getByTestId('formula-cap-notice')).toBeVisible()
    const value = await formula.inputValue()
    expect(value.length).toBeLessThanOrEqual(CAP)

    // The page is still responsive (no hang): Apply still works.
    await expect(page.getByRole('button', { name: /Apply/i })).toBeEnabled()
  })
})

// ─── Chart interval switch (replaces scroll & scale on the screener) ──────────
test.describe('Chart Interval Switch (screener)', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Screener')
    await waitForScreenerReady(page)
    await expandScreenerFilter(page)
    // Chart pane defaults collapsed; these tests exercise the in-chart interval switch.
    await openChart(page)
  })

  test('shows the interval dropdown and hides the scroll & scale controls', async ({ page }) => {
    const chartRegion = page.getByRole('region', { name: 'Symbol detail chart' })
    await expect(chartRegion).toBeVisible()
    // Chart loads for the default first row (ChartControls then mounts).
    await expect(page.locator('[data-testid="chart-container"]')).toBeVisible({ timeout: 30000 })

    // Interval control is a dropdown defaulting to 1D.
    const trigger = page.getByTestId('chart-interval-switch')
    await expect(trigger).toBeVisible()
    await expect(trigger).toContainText('1D')

    // Opening it lists the chart-renderable interval options.
    await trigger.click()
    await expect(page.getByTestId('interval-option-1D')).toBeVisible()
    await expect(page.getByTestId('interval-option-1W')).toBeVisible()
    await expect(page.getByTestId('interval-option-1M')).toBeVisible()
    await page.keyboard.press('Escape')

    // ChartControls IS rendered (overlay toggles present) but WITHOUT scroll & scale.
    await expect(chartRegion.getByRole('button', { name: /Trendlines/i })).toBeVisible()
    await expect(chartRegion.getByTitle(/Reset zoom/)).toHaveCount(0)
    await expect(chartRegion.getByTitle(/Zoom in/)).toHaveCount(0)
  })

  test('switching to 1W refetches at that interval and keeps the chart', async ({ page }) => {
    // The dropdown now lives in the chart control row, so it mounts with the chart.
    await expect(page.locator('[data-testid="chart-container"]')).toBeVisible({ timeout: 30000 })
    const trigger = page.getByTestId('chart-interval-switch')
    await expect(trigger).toBeVisible()

    // Open the dropdown and pick 1W — must fire a fresh /analyze request carrying interval=1W.
    await trigger.click()
    const req1w = page.waitForRequest(
      (r) => r.url().includes('/analyze/') && r.url().includes('interval=1W'),
      { timeout: 30000 }
    )
    await page.getByTestId('interval-option-1W').click()
    await req1w

    // 1W becomes the selected value and the chart re-renders without error.
    await expect(trigger).toContainText('1W')
    await expect(page.locator('[data-testid="chart-container"]')).toBeVisible({ timeout: 30000 })
  })

  test('removes the prev/next + in-pane hide buttons and the redundant header price', async ({ page }) => {
    const chartRegion = page.getByRole('region', { name: 'Symbol detail chart' })
    await expect(chartRegion).toBeVisible()
    await expect(page.locator('[data-testid="chart-container"]')).toBeVisible({ timeout: 30000 })

    // The prev/next move buttons AND the redundant in-pane "»" hide icon are gone;
    // collapsing the chart is handled by the "Chart" toggle in the results toolbar.
    await expect(page.getByRole('button', { name: 'Previous symbol' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Next symbol' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Hide chart pane' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Chart', exact: true })).toBeVisible()

    // The chart-pane header keeps the symbol label but no longer shows price/change.
    const header = page.getByTestId('symbol-detail-header')
    await expect(header).toBeVisible()
    const activeSymbol = await page.locator('[data-active="true"]').getAttribute('data-symbol')
    if (activeSymbol) await expect(header).toContainText(activeSymbol)
    await expect(header).not.toContainText('%')

    // The full company name is displayed beside the symbol. When the stock has a
    // real name (distinct from its symbol), it renders in full — the title carries
    // the complete name (no information loss vs. the old max-w-[160px] truncation).
    const nameEl = page.getByTestId('symbol-detail-name')
    if (await nameEl.count()) {
      await expect(nameEl).toBeVisible()
      const text = (await nameEl.textContent())?.trim() ?? ''
      expect(text.length).toBeGreaterThan(0)
      expect(await nameEl.getAttribute('title')).toBe(text)
    }
  })
})

// ─── Chart keyboard shortcuts removed (mouse-only) ────────────────────────────
test.describe('Chart mouse-only interaction', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Screener')
    await waitForScreenerReady(page)
    await expandScreenerFilter(page)
  })

  test('no longer shows the on-chart Wheel/Drag hint (removed)', async ({ page }) => {
    // Open the chart so the assertion runs against a mounted chart (the pane defaults
    // collapsed). ChartShortcutsHint was deleted, so the hint never renders anyway.
    await openChart(page)
    await expect(page.getByTestId('chart-shortcuts-hint')).toHaveCount(0)
  })
})

// ─── Column selector — click-controlled popover ───────────────────────────────
test.describe('Column Selector (screener)', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Screener')
    await waitForScreenerReady(page)
    await expandScreenerFilter(page)
  })

  test('opens on click, toggles a column pill, closes on Escape', async ({ page }) => {
    const trigger = page.getByTestId('column-selector-trigger')
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // Panel is not rendered until clicked (no hover-open).
    await expect(page.getByTestId('column-selector-panel')).toHaveCount(0)

    await trigger.click()
    const panel = page.getByTestId('column-selector-panel')
    await expect(panel).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    // The per-category All/None toggles are gone.
    await expect(panel.locator('[data-testid^="column-category-toggle-"]')).toHaveCount(0)

    // RS 6M is hidden by default; clicking its PILL reveals the table column header.
    const rs6mPill = panel.getByTestId('column-pill-rs6m')
    await expect(rs6mPill).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('columnheader', { name: 'RS 6M' })).toHaveCount(0)
    await rs6mPill.click()
    await expect(rs6mPill).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('columnheader', { name: 'RS 6M' })).toBeVisible()
    // The panel stays open while toggling pills inside it.
    await expect(panel).toBeVisible()
    // Clicking the pill again hides the column.
    await rs6mPill.click()
    await expect(rs6mPill).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('columnheader', { name: 'RS 6M' })).toHaveCount(0)

    // Escape closes the panel.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('column-selector-panel')).toHaveCount(0)
  })

  test('the Symbol pill is locked on', async ({ page }) => {
    await page.getByTestId('column-selector-trigger').click()
    const panel = page.getByTestId('column-selector-panel')
    await expect(panel).toBeVisible()

    const symbolPill = panel.getByTestId('column-pill-symbol')
    await expect(symbolPill).toHaveAttribute('aria-pressed', 'true')
    await expect(symbolPill).toHaveAttribute('aria-disabled', 'true')
    // Force a click past the aria-disabled actionability guard — the onClick guard
    // makes it a no-op; Symbol can never be hidden and its column header stays.
    await symbolPill.click({ force: true })
    await expect(symbolPill).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('columnheader', { name: 'Symbol' })).toBeVisible()
  })
})
