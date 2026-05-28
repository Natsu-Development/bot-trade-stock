import { test, expect, Page, Locator } from '@playwright/test'
import { navigateToPage, waitForPageHeading, resetTestConfig } from '../helpers'

/**
 * E2E coverage for the redesigned (Binance/exchange-style) Stock Alerts section
 * on the Config page. Verifies the collapsed table layout, the three-channel
 * color/state encoding (STATUS badge / category-count chips / expanded
 * enabled-disabled detail), expand-collapse interaction, and that the redesign
 * is presentation-only (PUT /config payload shape unchanged).
 *
 * Race-safety: tests run fullyParallel and share one backend config for
 * e2e_test_user. Like the sibling config.spec.ts, every alert here is built
 * through the editor into per-page LOCAL draft state (never persisted, never
 * reloaded), so a sibling's resetTestConfig can't wipe state mid-test. The one
 * Save test fulfills the PUT locally (route mock) so it never mutates shared
 * backend state either.
 */

const SYMBOL = 'FPT' // proven present in /stocks/filter by the existing config.spec.ts

async function goToConfigPage(page: Page) {
  await navigateToPage(page, 'Config')
  await waitForPageHeading(page, 'Trading Configuration')
}

async function openEditor(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Add Alert' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

async function pickSymbol(dialog: Locator, symbol: string) {
  await dialog.locator('#alert-symbol').fill(symbol)
  await dialog.getByRole('option', { name: symbol, exact: true }).click()
}

async function createAlert(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Create Alert' }).click()
  await expect(dialog).not.toBeVisible()
}

/** The collapsed summary row for a symbol (excludes the column header, which has no symbol text). */
function alertRow(page: Page, symbol: string): Locator {
  return page.locator('.alert-row-grid').filter({ hasText: symbol })
}

test.describe('Config — Stock Alerts (redesigned section)', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await goToConfigPage(page)
  })

  // ----------------------------------------------------------------------
  // Page still works after the redesign (smoke)
  // ----------------------------------------------------------------------
  test('config page renders all sections and actions after the redesign', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'RSI Settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Divergence Parameters' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Trendline Parameters' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Telegram Notifications' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Stock Alerts' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset Defaults' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save Config' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Alert' })).toBeVisible()
  })

  // ----------------------------------------------------------------------
  // Empty state: no rows, no column header, no expand controls
  // ----------------------------------------------------------------------
  test('empty state hides the table chrome (header + expand/collapse controls)', async ({ page }) => {
    await expect(page.getByText('No alerts configured')).toBeVisible()

    // Expand-all / Collapse-all controls are hidden when there are no alerts.
    await expect(page.getByRole('button', { name: 'Expand all' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Collapse all' })).toHaveCount(0)

    // The column header only renders with rows present.
    await expect(page.getByText('Watching', { exact: true })).toHaveCount(0)
  })

  // ----------------------------------------------------------------------
  // Collapsed row: status badge + neutral category-count chips, no pill wall
  // ----------------------------------------------------------------------
  test('collapsed active row shows ACTIVE badge, category-count chips and on/total — not raw condition pills', async ({ page }) => {
    const dialog = await openEditor(page)
    await pickSymbol(dialog, SYMBOL)
    // Two categories enabled: PRICE (price above) + VOLUME (volume spike).
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await dialog.getByRole('switch', { name: 'Enable Price above' }).click()
    await dialog.getByRole('textbox', { name: 'Volume spike threshold' }).fill('200')
    await dialog.getByRole('switch', { name: 'Enable Volume spike' }).click()
    await createAlert(dialog)

    // Column header appears now that a row exists.
    await expect(page.getByText('Watching', { exact: true })).toBeVisible()

    const row = alertRow(page, SYMBOL)
    await expect(row).toBeVisible()
    await expect(row).toContainText('ACTIVE')
    await expect(row).toContainText('PRICE 1')
    await expect(row).toContainText('VOL 1')
    await expect(row).toContainText('2/2') // on/total

    // The old per-condition "pill wall" text must NOT be in the collapsed view.
    await expect(page.getByText(/price > 100\.00 kVND/)).toHaveCount(0)
    // Detail region is not rendered while collapsed.
    await expect(page.locator('#alert-detail-FPT')).toHaveCount(0)
  })

  // ----------------------------------------------------------------------
  // Single-line invariant: the collapsed row is one line tall (no wrap)
  // ----------------------------------------------------------------------
  test('collapsed row stays a single line tall with four category chips', async ({ page }) => {
    const dialog = await openEditor(page)
    await pickSymbol(dialog, SYMBOL)
    // Four categories: PRICE, VOLUME, MA, TRENDLINE (<= MAX_CHIPS, so chips, no summary).
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await dialog.getByRole('switch', { name: 'Enable Price above' }).click()
    await dialog.getByRole('textbox', { name: 'Volume spike threshold' }).fill('200')
    await dialog.getByRole('switch', { name: 'Enable Volume spike' }).click()
    await dialog.getByRole('button', { name: 'Enable EMA 21 for Price crosses above MA' }).click()
    await dialog.getByRole('switch', { name: 'Enable Trendline breakout (potential)' }).click()
    await createAlert(dialog)

    const row = alertRow(page, SYMBOL)
    await expect(row).toContainText('PRICE 1')
    await expect(row).toContainText('TREND 1')
    await expect(row).not.toContainText('Σ') // four chips → not summarized

    // One text line + vertical padding (py-2) → comfortably under 56px. A wrapped
    // chip row would roughly double this.
    const box = await row.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeLessThan(56)
  })

  // ----------------------------------------------------------------------
  // WATCHING summarizes to "Σ n on" beyond 4 categories
  // ----------------------------------------------------------------------
  test('WATCHING collapses to "Σ n on" when more than four categories are enabled', async ({ page }) => {
    const dialog = await openEditor(page)
    await pickSymbol(dialog, SYMBOL)
    // All five categories enabled.
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await dialog.getByRole('switch', { name: 'Enable Price above' }).click()
    await dialog.getByRole('textbox', { name: 'Volume spike threshold' }).fill('200')
    await dialog.getByRole('switch', { name: 'Enable Volume spike' }).click()
    await dialog.getByRole('button', { name: 'Enable EMA 21 for Price crosses above MA' }).click()
    await dialog.getByRole('switch', { name: 'Enable Trendline breakout (potential)' }).click()
    await dialog.getByRole('switch', { name: 'Enable Bullish RSI divergence', exact: true }).click()
    await createAlert(dialog)

    const row = alertRow(page, SYMBOL)
    await expect(row).toContainText('Σ 5 on')
    await expect(row).toContainText('5/5')
    await expect(row).not.toContainText('PRICE 1') // individual chips replaced by the summary
  })

  // ----------------------------------------------------------------------
  // Expand / collapse a row reveals the per-condition detail
  // ----------------------------------------------------------------------
  test('expanding a row reveals grouped condition detail with enabled/disabled fill', async ({ page }) => {
    const dialog = await openEditor(page)
    await pickSymbol(dialog, SYMBOL)
    // PRICE category: one enabled (price above) + one disabled (price below threshold
    // typed but switch left off → stored as enabled:false).
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await dialog.getByRole('switch', { name: 'Enable Price above' }).click()
    await dialog.getByRole('textbox', { name: 'Price below threshold' }).fill('90')
    await createAlert(dialog)

    const row = alertRow(page, SYMBOL)
    await expect(row).toContainText('PRICE 1') // only the enabled one is counted
    await expect(row).toContainText('1/2') // 1 enabled of 2 total

    // Disabled condition detail is hidden until expanded.
    await expect(page.getByText(/price < 90\.00 kVND/)).toHaveCount(0)

    const chevron = page.getByRole('button', { name: /conditions for FPT/i })
    await expect(chevron).toHaveAttribute('aria-expanded', 'false')
    await chevron.click()
    await expect(chevron).toHaveAttribute('aria-expanded', 'true')

    const detail = page.getByRole('region', { name: 'Conditions for FPT' })
    await expect(detail).toBeVisible()
    await expect(detail).toContainText('Price') // category group label
    await expect(detail.getByText('enabled')).toBeVisible() // the price-above row
    await expect(detail.getByText('disabled')).toBeVisible() // the price-below row
    await expect(detail).toContainText(/price > 100\.00 kVND/)
    await expect(detail).toContainText(/price < 90\.00 kVND/)
    await expect(detail.getByRole('button', { name: 'Edit alert for FPT in modal' })).toBeVisible()

    // Collapse again.
    await chevron.click()
    await expect(chevron).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('region', { name: 'Conditions for FPT' })).toHaveCount(0)
  })

  // ----------------------------------------------------------------------
  // Status badge: PAUSED for an all-disabled alert
  // ----------------------------------------------------------------------
  test('a fully-disabled alert is PAUSED with "Σ 0 on" and 0/total', async ({ page }) => {
    const dialog = await openEditor(page)
    await pickSymbol(dialog, SYMBOL)
    // Type a threshold but never enable the switch → a single disabled condition.
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await createAlert(dialog)

    const row = alertRow(page, SYMBOL)
    await expect(row).toContainText('PAUSED')
    await expect(row).not.toContainText('ACTIVE')
    await expect(row).toContainText('Σ 0 on')
    await expect(row).toContainText('0/1')
  })

  // ----------------------------------------------------------------------
  // Expand all / Collapse all controls
  // ----------------------------------------------------------------------
  test('Expand all / Collapse all toggle the row detail and their own disabled state', async ({ page }) => {
    const dialog = await openEditor(page)
    await pickSymbol(dialog, SYMBOL)
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await dialog.getByRole('switch', { name: 'Enable Price above' }).click()
    await createAlert(dialog)

    const expandAll = page.getByRole('button', { name: 'Expand all' })
    const collapseAll = page.getByRole('button', { name: 'Collapse all' })

    // Nothing expanded yet: Collapse all is disabled.
    await expect(collapseAll).toBeDisabled()

    await expandAll.click()
    await expect(page.getByRole('region', { name: 'Conditions for FPT' })).toBeVisible()
    await expect(expandAll).toBeDisabled() // all rows expanded
    await expect(collapseAll).toBeEnabled()

    await collapseAll.click()
    await expect(page.getByRole('region', { name: 'Conditions for FPT' })).toHaveCount(0)
    await expect(collapseAll).toBeDisabled()
  })

  // ----------------------------------------------------------------------
  // Editing routes to the modal (row action + detail "Edit in modal")
  // ----------------------------------------------------------------------
  test('row edit icon and detail "Edit in modal" both open the editor', async ({ page }) => {
    const dialog = await openEditor(page)
    await pickSymbol(dialog, SYMBOL)
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await dialog.getByRole('switch', { name: 'Enable Price above' }).click()
    await createAlert(dialog)

    // Row edit icon → editor.
    await page.getByRole('button', { name: 'Edit alert for FPT' }).click()
    const editor = page.getByRole('dialog')
    await expect(editor.getByRole('heading', { name: /Edit Alert/ })).toBeVisible()
    await editor.getByRole('button', { name: 'Cancel' }).click()
    await expect(editor).not.toBeVisible()

    // Detail "Edit in modal" → editor.
    await page.getByRole('button', { name: /conditions for FPT/i }).click()
    await page.getByRole('button', { name: 'Edit alert for FPT in modal' }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: /Edit Alert/ })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  })

  // ----------------------------------------------------------------------
  // Delete removes the row (and self-heals expand state)
  // ----------------------------------------------------------------------
  test('deleting the only alert returns to the empty state', async ({ page }) => {
    const dialog = await openEditor(page)
    await pickSymbol(dialog, SYMBOL)
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await dialog.getByRole('switch', { name: 'Enable Price above' }).click()
    await createAlert(dialog)

    await expect(alertRow(page, SYMBOL)).toBeVisible()

    // Expand it first, then delete — the expanded detail must not ghost.
    await page.getByRole('button', { name: /conditions for FPT/i }).click()
    await expect(page.getByRole('region', { name: 'Conditions for FPT' })).toBeVisible()

    page.once('dialog', (d) => d.accept()) // window.confirm
    await page.getByRole('button', { name: 'Delete alert for FPT' }).click()

    await expect(alertRow(page, SYMBOL)).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Conditions for FPT' })).toHaveCount(0)
    await expect(page.getByText('No alerts configured')).toBeVisible()
  })

  // ----------------------------------------------------------------------
  // Presentation-only guarantee: PUT /config alert payload shape is unchanged
  // ----------------------------------------------------------------------
  test('saving sends the unchanged alert payload shape (no presentation fields leak)', async ({ page }) => {
    // Mock the PUT so we capture the body without mutating shared backend state.
    let putBody: { alerts?: Array<{ symbol: string; conditions: Record<string, unknown>[] }> } | null = null
    await page.route('**/config/**', async (route) => {
      const req = route.request()
      if (req.method() === 'PUT') {
        putBody = req.postDataJSON()
        // Echo the posted (full) config back so the app's success path renders.
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: req.postData() ?? '{}',
        })
      } else {
        await route.continue()
      }
    })

    const dialog = await openEditor(page)
    await pickSymbol(dialog, SYMBOL)
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await dialog.getByRole('switch', { name: 'Enable Price above' }).click()
    await createAlert(dialog)

    await page.getByRole('button', { name: 'Save Config' }).click()
    await expect(page.getByText('Configuration saved successfully!')).toBeVisible()

    expect(putBody).not.toBeNull()
    const alerts = putBody!.alerts ?? []
    const fpt = alerts.find((a) => a.symbol === SYMBOL)
    expect(fpt).toBeTruthy()
    expect(fpt!.conditions.length).toBe(1)
    const cond = fpt!.conditions[0]
    // Exactly the canonical condition shape — no extra UI/presentation keys.
    expect(Object.keys(cond).sort()).toEqual(['enabled', 'threshold', 'type'])
    expect(cond.type).toBe('price_above')
    expect(cond.threshold).toBe(100)
    expect(cond.enabled).toBe(true)
  })
})
