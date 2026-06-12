import { test, expect } from '@playwright/test'
import { navigateToPage, resetTestConfig } from '../helpers'

type Page = import('@playwright/test').Page

/** Navigate to the Analyze page and wait for it to be ready. The page no longer
 *  renders an "Analyze" h1 (the header was removed), so we wait on the watchlist
 *  sidebar instead of a page heading. */
async function gotoAnalyze(page: Page) {
  await navigateToPage(page, 'Analyze')
  await expect(page.getByTestId('analyze-sidebar')).toBeVisible()
}

/** Load a symbol via the ON-CHART symbol box (Enter), then wait for the chart to
 *  render. Symbol entry lives on the chart header, not in the sidebar. */
async function loadSymbol(page: Page, symbol: string) {
  const box = page.getByTestId('analyze-chart-symbol-input')
  await box.fill(symbol)
  await box.press('Enter')
  await expect(page.locator('[data-testid="chart-container"]')).toBeVisible({ timeout: 30000 })
}

test.describe('Analyze Page (TradingView revamp)', () => {
  // All tests here mutate the SAME shared backend config (e2e_test_user), and every
  // beforeEach resets it to an empty watchlist. Under fullyParallel that reset races
  // the seeded-watchlist tests' mount-GET (one test wipes another's seed mid-flight),
  // so run this file serially — the standard idiom for tests sharing mutable server state.
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await gotoAnalyze(page)
  })

  test.describe('Page structure', () => {
    test('has NO page header — title / subtitle / clock / History are removed', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Analyze' })).toHaveCount(0)
      await expect(page.getByText('RSI divergence & trendline pattern detection')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'History' })).toHaveCount(0)
    })

    test('shows the persistent watchlist sidebar', async ({ page }) => {
      await expect(page.getByTestId('analyze-sidebar')).toBeVisible()
    })

    test('symbol entry lives ON the chart — sidebar has no add input', async ({ page }) => {
      await expect(page.getByTestId('analyze-chart-symbol-input')).toBeVisible()
      await expect(page.getByTestId('analyze-chart-add')).toBeVisible()
      // Removed in earlier rounds: the sidebar search/add box + the old control bar.
      await expect(page.getByTestId('analyze-symbol-search')).toHaveCount(0)
      await expect(page.getByTestId('analyze-symbol-add')).toHaveCount(0)
      await expect(page.getByTestId('analyze-symbol-input')).toHaveCount(0)
      await expect(page.getByTestId('analyze-run')).toHaveCount(0)
    })

    test('uppercases the on-chart symbol input', async ({ page }) => {
      const input = page.getByTestId('analyze-chart-symbol-input')
      await input.fill('vcb')
      await expect(input).toHaveValue('VCB')
    })

    test('empty chart state prompts to type a symbol', async ({ page }) => {
      await expect(page.getByText(/Type a symbol above .* to load the chart/)).toBeVisible()
    })
  })

  test.describe('Signal-type filter + signals table (relocated strip)', () => {
    test('chips read All / Breakout / Breakdown / Confirmed / Potential — never "Watching"', async ({ page }) => {
      await expect(page.getByTestId('signal-chip-all')).toBeVisible()
      await expect(page.getByTestId('signal-chip-breakout')).toBeVisible()
      await expect(page.getByTestId('signal-chip-breakdown')).toBeVisible()
      await expect(page.getByTestId('signal-chip-confirmed')).toBeVisible()
      await expect(page.getByTestId('signal-chip-potential')).toBeVisible()
      await expect(page.getByText('Watching', { exact: true })).toHaveCount(0)
    })

    test('selecting a chip activates it with a visible (non-transparent) background', async ({ page }) => {
      const breakdown = page.getByTestId('signal-chip-breakdown')
      await breakdown.click()
      await expect(breakdown).toHaveAttribute('aria-pressed', 'true')
      await expect(breakdown).toHaveCSS('background-color', 'rgb(255, 51, 102)')
    })

    test('renders the signals TABLE and NO standalone divergence cards (divergence lives on the RSI pane)', async ({ page }) => {
      await expect(page.getByTestId('analyze-signals-table')).toBeVisible()
      await expect(page.getByTestId('divergence-card-bullish')).toHaveCount(0)
      await expect(page.getByTestId('divergence-card-bearish')).toHaveCount(0)
    })
  })

  test.describe('Sidebar collapse', () => {
    test('collapsing the sidebar keeps the chart usable', async ({ page }) => {
      await loadSymbol(page, 'FPT')

      await page.getByTestId('analyze-sidebar-toggle').click()
      await expect(page.getByTestId('analyze-watchlist')).toHaveCount(0)
      await expect(page.locator('[data-testid="chart-container"]')).toBeVisible()
    })
  })

  test.describe('Analysis execution', () => {
    test('loads the chart with RSI toggle + overlay controls', async ({ page }) => {
      await loadSymbol(page, 'FPT')

      await expect(page.getByRole('button', { name: /Trendlines/i })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Signals', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'RSI', exact: true })).toBeVisible()
      await expect(page.getByText(/Latest:/)).toBeVisible()
    })

    test('timeframe lives IN the chart — interval dropdown shown, nav/zoom controls hidden', async ({ page }) => {
      await loadSymbol(page, 'FPT')

      const trigger = page.getByTestId('chart-interval-switch')
      await expect(trigger).toBeVisible()
      await expect(trigger).toContainText('1D')
      await trigger.click()
      await expect(page.getByTestId('interval-option-1D')).toBeVisible()
      await expect(page.getByTestId('interval-option-1W')).toBeVisible()
      await expect(page.getByTestId('interval-option-1M')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTitle('Reset zoom')).toHaveCount(0)
      await expect(page.getByTitle('Zoom in')).toHaveCount(0)
      await expect(page.getByTitle('Go to start')).toHaveCount(0)
    })

    test('switching the in-chart timeframe reloads the chart', async ({ page }) => {
      await loadSymbol(page, 'FPT')
      const trigger = page.getByTestId('chart-interval-switch')
      await trigger.click()
      // Selecting 1W must fire a fresh /analyze request carrying interval=1W.
      const req1w = page.waitForRequest(
        (r) => r.url().includes('/analyze/') && r.url().includes('interval=1W'),
        { timeout: 30000 }
      )
      await page.getByTestId('interval-option-1W').click()
      await req1w
      await expect(trigger).toContainText('1W')
      await expect(page.locator('[data-testid="chart-container"]')).toBeVisible({ timeout: 30000 })
    })

    test('RSI is ON by default with a draggable divider once a symbol loads', async ({ page }) => {
      await loadSymbol(page, 'FPT')
      await expect(page.getByTestId('rsi-divider')).toBeVisible()
    })
  })

  test.describe('Watchlist', () => {
    test('add via the on-chart control persists (PUT succeeds with the disabled seed condition)', async ({ page }) => {
      // Empty watchlist → nothing auto-selected; type a symbol to load it, then add.
      const box = page.getByTestId('analyze-chart-symbol-input')
      await box.fill('FPT')
      await box.press('Enter')
      const configPut = page.waitForResponse(
        (r) => r.url().includes('/config/') && r.request().method() === 'PUT'
      )
      await page.getByTestId('analyze-chart-add').click()
      // If the PUT had been rejected (e.g. empty conditions), the optimistic add
      // would roll back and the row would vanish. It must persist.
      await expect(page.getByTestId('watchlist-item-FPT')).toBeVisible()
      await configPut
      await expect(page.getByTestId('watchlist-item-FPT')).toBeVisible()
      await expect(page.getByTestId('analyze-chart-add')).toContainText('In watchlist')
    })

    test('per-row X is the only remove affordance — no redundant toggle or sidebar input', async ({ page }) => {
      await resetTestConfig(['VCB'])
      await gotoAnalyze(page)

      await expect(page.getByTestId('watchlist-item-VCB')).toBeVisible()
      await expect(page.getByTestId('watchlist-remove-VCB')).toBeAttached()
      await expect(page.getByTestId('watchlist-toggle-current')).toHaveCount(0)
      await expect(page.getByTestId('analyze-symbol-search')).toHaveCount(0)
    })

    test('auto-selects the FIRST watchlist symbol on entry, then quick-switch loads another', async ({ page }) => {
      await resetTestConfig(['VCB', 'HPG'])
      await gotoAnalyze(page)

      // Auto-select: the first watchlist symbol loads with no interaction; its row
      // shows the selected-state indicator and the chart renders.
      await expect(page.getByTestId('analyze-chart-symbol-input')).toHaveValue('VCB')
      await expect(page.getByTestId('watchlist-active-VCB')).toBeVisible()
      await expect(page.locator('[data-testid="chart-container"]')).toBeVisible({ timeout: 30000 })

      // Quick-switch to the other symbol — the indicator + symbol box follow it.
      await page.getByTestId('watchlist-item-HPG').click()
      await expect(page.getByTestId('analyze-chart-symbol-input')).toHaveValue('HPG')
      await expect(page.getByTestId('watchlist-active-HPG')).toBeVisible()
    })
  })

  test.describe('Deep link (path routing)', () => {
    test('/analyze?symbol=VCB loads VCB into the chart + symbol box (no hash)', async ({ page }) => {
      await page.goto('/analyze?symbol=VCB')
      await expect(page.getByTestId('analyze-sidebar')).toBeVisible()
      await expect(page.getByTestId('analyze-chart-symbol-input')).toHaveValue('VCB')
      await expect(page.locator('[data-testid="chart-container"]')).toBeVisible({ timeout: 30000 })
      // Path-based, not hash-based, and the symbol param is stripped after consumption.
      await expect.poll(() => new URL(page.url()).pathname).toBe('/analyze')
      expect(page.url()).not.toContain('#')
      expect(page.url()).not.toContain('symbol=')
    })
  })
})
