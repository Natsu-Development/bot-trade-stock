import { test, expect, type Page } from '@playwright/test'
import { navigateToPage } from '../helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Screener: active-row highlight bug fix + "Add to watchlist" (→ Watchlist).
//
// Stock rows come from the LIVE backend (/stocks/filter). The config endpoint is
// mocked so the watchlist flow is deterministic and never mutates shared state:
//   GET  /config/* → a config with no watchlist entries (so selected symbols are always fresh)
//   PUT  /config/* → captured (the add-to-watchlist payload) and echoed back 200
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CONFIG = {
  id: 'e2e_test_user',
  rsi_period: 14,
  pivot_period: 5,
  divergence: { range_min: 30, range_max: 70 },
  trendline: { max_lines: 5, proximity_percent: 3 },
  signal_days_threshold: 30,
  watchlist: [],
  metrics_filter: [],
  telegram: { enabled: false },
}

/** Result-table data rows (the header row has role=row but no data-symbol). */
async function dataRows(page: Page) {
  const rows = page.locator('[role="row"][data-symbol]')
  await expect(rows.first()).toBeVisible({ timeout: 15000 })
  return rows
}

test.describe('Screener — active highlight + add to watchlist', () => {
  test('clicking a row moves the active highlight to that symbol', async ({ page }) => {
    await navigateToPage(page, 'Screener')
    const rows = await dataRows(page)
    const count = await rows.count()
    expect(count).toBeGreaterThan(1)

    // Pick a row that is NOT the default-active first row.
    const target = rows.nth(Math.min(2, count - 1))
    const sym = await target.getAttribute('data-symbol')
    expect(sym).toBeTruthy()

    await target.getByTestId('screener-symbol-button').click()

    // US-002 fix: the highlight is driven by the data-active attribute (toggled
    // imperatively), so exactly one row is active and it is the one we clicked.
    await expect(page.locator('[data-active="true"]')).toHaveCount(1)
    await expect(page.locator(`[data-symbol="${sym}"][data-active="true"]`)).toHaveCount(1)
  })

  test('selecting rows + "Add to watchlist" adds them to the watchlist', async ({ page }) => {
    let putBody:
      | { rsi_period?: number; watchlist?: Array<{ symbol: string; conditions: Array<{ type: string }> }> }
      | null = null
    await page.route('**/config/**', async (route) => {
      const req = route.request()
      if (req.method() === 'PUT') {
        putBody = req.postDataJSON()
        await route.fulfill({ status: 200, contentType: 'application/json', body: req.postData() ?? '{}' })
      } else if (req.method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CONFIG) })
      } else {
        await route.continue()
      }
    })

    await navigateToPage(page, 'Screener')
    const rows = await dataRows(page)
    expect(await rows.count()).toBeGreaterThan(1)

    const sym0 = await rows.nth(0).getAttribute('data-symbol')
    const sym1 = await rows.nth(1).getAttribute('data-symbol')

    // Select the first two rows via their themed checkboxes.
    await rows.nth(0).getByRole('checkbox').click()
    await rows.nth(1).getByRole('checkbox').click()

    // The selection action bar appears with the count.
    await expect(page.getByText('2 selected')).toBeVisible()

    await page.getByRole('button', { name: /Add to watchlist/i }).click()

    // Success toast + the PUT payload carries both symbols, each seeded with a
    // bullish_divergence condition.
    await expect(page.getByText(/Added 2 symbols to your watchlist/i)).toBeVisible({ timeout: 10000 })
    expect(putBody).toBeTruthy()
    const putSymbols = (putBody!.watchlist ?? []).map((a) => a.symbol)
    expect(putSymbols).toEqual(expect.arrayContaining([sym0, sym1]))
    for (const a of putBody!.watchlist ?? []) {
      expect(a.conditions[0]?.type).toBe('bullish_divergence')
    }
    // The PUT must carry the FULL config (spread), not a partial that would wipe
    // other fields — guards against a future regression to a partial payload.
    expect(putBody!.rsi_period).toBe(MOCK_CONFIG.rsi_period)
    // Selection is cleared after a successful add (action bar disappears).
    await expect(page.getByText('2 selected')).toHaveCount(0)
  })
})
