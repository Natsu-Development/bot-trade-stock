import { test, expect, Page } from '@playwright/test'
import { navigateToPage, waitForPageHeading, resetTestConfig, TEST_USERNAME } from '../helpers'

async function clearAuth(page: Page) {
  await page.context().clearCookies()
  await page.goto('/')
  await page.evaluate(() => {
    try { localStorage.clear() } catch { /* ignore */ }
  })
}

async function loginViaDialog(page: Page, username: string) {
  await page.goto('/')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })
  await page.getByRole('textbox', { name: 'Username' }).fill(username)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })
}

async function goToConfigPage(page: Page) {
  await navigateToPage(page, 'Config')
  await waitForPageHeading(page, 'Trading Configuration')
}

// ============================================================
// AUTHENTICATION TESTS
// ============================================================
test.describe('Authentication', () => {
  test.use({ storageState: undefined })

  test('should show welcome dialog on first visit', async ({ page }) => {
    await clearAuth(page)
    await page.reload()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Welcome to Trading Bot')).toBeVisible()
  })

  test('should require valid username', async ({ page }) => {
    await clearAuth(page)
    await page.reload()

    const input = page.getByRole('textbox', { name: 'Username' })
    const btn = page.getByRole('button', { name: 'Continue' })

    // Too short (1 char)
    await input.fill('a')
    await expect(btn).toBeDisabled()

    // Valid username
    await input.fill('valid_user')
    await expect(btn).toBeEnabled()
  })

  test('should login successfully', async ({ page }) => {
    await clearAuth(page)
    await resetTestConfig()
    await loginViaDialog(page, TEST_USERNAME)
    await expect(page.locator('nav')).toBeVisible()
  })
})

// ============================================================
// CONFIG PAGE TESTS
// ============================================================
test.describe('Config Page', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await goToConfigPage(page)
  })

  // --------------------------------------------------------
  // Page Structure Tests
  // --------------------------------------------------------
  test('should display all config sections', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForTimeout(1000)

    await expect(page.getByRole('heading', { name: 'RSI Settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Divergence Parameters' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Trendline Parameters' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Stock Alerts' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Telegram Notifications' })).toBeVisible()
  })

  test('should display action buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Reset Defaults' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save Config' })).toBeVisible()
  })

  // --------------------------------------------------------
  // Form Input Tests
  // --------------------------------------------------------
  test('should have RSI period input', async ({ page }) => {
    const input = page.getByRole('textbox').first()
    await expect(input).toBeVisible()
    await input.fill('21')
    await expect(input).toHaveValue('21')
  })

  test('should have divergence range inputs', async ({ page }) => {
    // NumberInput renders type="text" (role textbox), not a native spinbutton.
    const inputs = page.getByRole('textbox')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(5) // RSI, Pivot, Lookback, Range Min, Range Max, …
  })

  test('should have signal recency window input', async ({ page }) => {
    // signal_days_threshold — gates how recent an analyze signal must be to fire.
    await expect(page.getByText('Signal recency window (days)')).toBeVisible()
  })

  // --------------------------------------------------------
  // Stock Alerts Tests
  // --------------------------------------------------------
  test('should display Stock Alerts section with Add Alert', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Stock Alerts' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Alert' })).toBeVisible()
  })

  test('should open the alert editor with all condition types', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Alert' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Create Alert' })).toBeVisible()
    await expect(dialog.locator('#alert-symbol')).toBeVisible()

    // One representative control per condition category.
    await expect(dialog.getByRole('switch', { name: 'Enable Price above' })).toBeVisible()
    await expect(dialog.getByRole('switch', { name: 'Enable Volume spike' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Enable EMA 21 for Price crosses above MA' })).toBeVisible()
    await expect(dialog.getByRole('switch', { name: 'Enable Trendline breakout (potential)' })).toBeVisible()
    await expect(dialog.getByRole('switch', { name: 'Enable Bullish RSI divergence', exact: true })).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('should add a stock alert via the editor', async ({ page }) => {
    // Drive the editor and assert the card renders from local state (no reload).
    // Race-immune under fullyParallel: every test shares e2e_test_user's backend
    // config, so a sibling's resetTestConfig would wipe any seeded+reloaded
    // state; local draft state is per-page and unaffected.
    await page.getByRole('button', { name: 'Add Alert' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Choose a symbol from the autocomplete (loaded from /stocks/filter).
    await dialog.locator('#alert-symbol').fill('FPT')
    await dialog.getByRole('option', { name: 'FPT', exact: true }).click()

    // Enable a Price-above threshold condition.
    await dialog.getByRole('textbox', { name: 'Price above threshold' }).fill('100')
    await dialog.getByRole('switch', { name: 'Enable Price above' }).click()

    await dialog.getByRole('button', { name: 'Create Alert' }).click()
    await expect(dialog).not.toBeVisible()

    // The new alert card is in the Stock Alerts list.
    await expect(page.getByRole('button', { name: 'Edit alert for FPT' })).toBeVisible()
  })

  // --------------------------------------------------------
  // Telegram Tests
  // --------------------------------------------------------
  test('should have telegram toggle', async ({ page }) => {
    const checkbox = page.getByRole('checkbox', { name: /telegram/i })
    await expect(checkbox).toBeVisible()
  })

  test('should show telegram fields when enabled', async ({ page }) => {
    await page.getByRole('checkbox', { name: /telegram/i }).check()
    await expect(page.getByPlaceholder(/token/i)).toBeVisible()
    await expect(page.getByPlaceholder(/chat/i)).toBeVisible()
  })

  // --------------------------------------------------------
  // Save/Reset Tests
  // --------------------------------------------------------
  test('should save configuration', async ({ page }) => {
    const input = page.getByRole('textbox').first()
    await input.fill('21')

    await page.getByRole('button', { name: 'Save Config' }).click()
    await expect(page.getByText('Configuration saved successfully!')).toBeVisible()
  })

  test('should reset form', async ({ page }) => {
    const input = page.getByRole('textbox').first()
    await input.fill('30')

    await page.getByRole('button', { name: 'Reset Defaults' }).click()
    await expect(page.getByText('Form reset to saved values')).toBeVisible()
  })
})