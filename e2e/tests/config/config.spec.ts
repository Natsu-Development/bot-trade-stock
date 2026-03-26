import { test, expect, Page } from '@playwright/test'
import { navigateToPage, waitForPageHeading, resetTestConfig, TEST_USERNAME, API_BASE } from '../helpers'

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
    await expect(page.getByRole('heading', { name: 'Bullish Watch Symbols' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bearish Watch Symbols' })).toBeVisible()
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
    const input = page.getByRole('spinbutton').first()
    await expect(input).toBeVisible()
    await input.fill('21')
    await expect(input).toHaveValue('21')
  })

  test('should have divergence range inputs', async ({ page }) => {
    const inputs = page.getByRole('spinbutton')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(5) // RSI, Pivot, Lookback, Range Min, Range Max
  })

  test('should have early detection checkbox', async ({ page }) => {
    const checkbox = page.getByRole('checkbox').first()
    await expect(checkbox).toBeVisible()
  })

  // --------------------------------------------------------
  // Watchlist Tests
  // --------------------------------------------------------
  test('should display watchlist symbols', async ({ page }) => {
    // Check that VIC and VCB are visible somewhere on the page
    await expect(page.getByText('VIC')).toBeVisible()
    await expect(page.getByText('VCB')).toBeVisible()
  })

  test('should have symbol input fields', async ({ page }) => {
    const inputs = page.getByPlaceholder('Add symbol and press Enter')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(2) // Bullish and Bearish inputs
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
    const input = page.getByRole('spinbutton').first()
    await input.fill('21')

    await page.getByRole('button', { name: 'Save Config' }).click()
    await expect(page.getByText('Configuration saved successfully!')).toBeVisible()
  })

  test('should reset form', async ({ page }) => {
    const input = page.getByRole('spinbutton').first()
    await input.fill('30')

    await page.getByRole('button', { name: 'Reset Defaults' }).click()
    await expect(page.getByText('Form reset to saved values')).toBeVisible()
  })
})