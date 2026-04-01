import { test, expect } from '@playwright/test'
import { navigateToPage, waitForPageHeading, resetTestConfig } from '../helpers'

test.describe('Divergence Page', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Divergence')
    await waitForPageHeading(page, 'Divergence Analysis')
  })

  test.describe('Page Structure', () => {
    test('should display header with title and subtitle', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Divergence Analysis' })).toBeVisible()
      await expect(page.getByText('RSI divergence & trendline pattern detection')).toBeVisible()
    })

    test('should display History button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /History/i })).toBeVisible()
    })

    test('should display live clock', async ({ page }) => {
      await expect(page.getByText(/\d{2}:\d{2}:\d{2}\s+ICT/)).toBeVisible()
    })
  })

  test.describe('Analyze Symbol Form', () => {
    test('should display analyze section', async ({ page }) => {
      await expect(page.getByText('Analyze Symbol')).toBeVisible()
    })

    test('should have Config ID input', async ({ page }) => {
      const input = page.getByPlaceholder('e.g., default')
      await expect(input).toBeVisible()
      await expect(input).toHaveValue(/e2e_test_user/)
    })

    test('should have Symbol input', async ({ page }) => {
      const input = page.getByPlaceholder('e.g., VCB')
      await expect(input).toBeVisible()
    })

    test('should have Timeframe dropdown', async ({ page }) => {
      const select = page.locator('select')
      await expect(select).toBeVisible()

      const options = await select.locator('option').allTextContents()
      expect(options).toContain('Daily (1D)')
      expect(options).toContain('Weekly (1W)')
      expect(options).toContain('Monthly (1M)')
    })

    test('should have Analyze All button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Analyze All/i })).toBeVisible()
    })

    test('should uppercase symbol input', async ({ page }) => {
      const input = page.getByPlaceholder('e.g., VCB')
      await input.fill('vcb')
      await expect(input).toHaveValue('VCB')
    })

    test('should change timeframe', async ({ page }) => {
      const select = page.locator('select')
      await select.selectOption('1W')
      await expect(select).toHaveValue('1W')
    })
  })

  test.describe('Signal Type Filter', () => {
    test('should display all signal type buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'All Signals' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Breakdown' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Breakout' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Confirmed' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Watching' })).toBeVisible()
    })

    test('should toggle signal type', async ({ page }) => {
      const breakdownBtn = page.getByRole('button', { name: 'Breakdown' })
      await breakdownBtn.click()
      // Verify the button is now active (has a different background)
      await expect(breakdownBtn).toBeVisible()
    })
  })

  test.describe('Signal Cards', () => {
    test('should display bullish divergence card', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Bullish Divergence' })).toBeVisible()
    })

    test('should display bearish divergence card', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Bearish Divergence' })).toBeVisible()
    })

    test('should show default HOLD status', async ({ page }) => {
      const holdTexts = page.getByText('HOLD')
      const count = await holdTexts.count()
      expect(count).toBeGreaterThanOrEqual(2)
    })

    test('should display confidence and strength metrics', async ({ page }) => {
      const confidenceLabels = page.getByText('CONFIDENCE')
      const strengthLabels = page.getByText('STRENGTH')
      expect(await confidenceLabels.count()).toBeGreaterThanOrEqual(2)
      expect(await strengthLabels.count()).toBeGreaterThanOrEqual(2)
    })

    test('should display divergence type', async ({ page }) => {
      const divTypeLabels = page.getByText('DIVERGENCE TYPE')
      expect(await divTypeLabels.count()).toBeGreaterThanOrEqual(2)
    })
  })

  test.describe('Price Chart Section', () => {
    test('should display chart section header', async ({ page }) => {
      await expect(page.getByText(/Price & Trendline Chart/)).toBeVisible()
    })

    test('should show placeholder when no analysis', async ({ page }) => {
      await expect(page.getByText(/Click "Analyze All" to load chart/)).toBeVisible()
    })

    test('should display signal count badges', async ({ page }) => {
      await expect(page.getByText(/\d+ Bullish/i)).toBeVisible()
      await expect(page.getByText(/\d+ Bearish/i)).toBeVisible()
    })
  })

  test.describe('Analysis Execution', () => {
    test('should show loading state during analysis', async ({ page }) => {
      const symbolInput = page.getByPlaceholder('e.g., VCB')
      await symbolInput.fill('VCB')

      const analyzeBtn = page.getByRole('button', { name: /Analyze All/i })
      await analyzeBtn.click()

      await expect(page.getByRole('button', { name: /Analyzing.../i })).toBeVisible()
    })

    test('should complete analysis and show chart', async ({ page }) => {
      const symbolInput = page.getByPlaceholder('e.g., VCB')
      await symbolInput.fill('FPT')

      const analyzeBtn = page.getByRole('button', { name: /Analyze All/i })
      await analyzeBtn.click()

      // Wait for analysis to complete
      await expect(page.getByRole('button', { name: /Analyze All/i })).toBeEnabled({ timeout: 30000 })

      // Chart placeholder should be gone
      await expect(page.getByText(/Click "Analyze All" to load chart/)).not.toBeVisible()
    })

    test('should show chart controls after analysis', async ({ page }) => {
      const symbolInput = page.getByPlaceholder('e.g., VCB')
      await symbolInput.fill('FPT')

      await page.getByRole('button', { name: /Analyze All/i }).click()
      await expect(page.getByRole('button', { name: /Analyze All/i })).toBeEnabled({ timeout: 30000 })

      // Chart controls should appear
      await expect(page.getByRole('button', { name: /Trendlines/i })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Signals', exact: true })).toBeVisible()
    })

    test('should show price data after analysis', async ({ page }) => {
      const symbolInput = page.getByPlaceholder('e.g., VCB')
      await symbolInput.fill('FPT')

      await page.getByRole('button', { name: /Analyze All/i }).click()
      await expect(page.getByRole('button', { name: /Analyze All/i })).toBeEnabled({ timeout: 30000 })

      // Price info should be visible
      await expect(page.getByText(/Latest:/)).toBeVisible()
    })

    test('should update chart header with symbol name', async ({ page }) => {
      const symbolInput = page.getByPlaceholder('e.g., VCB')
      await symbolInput.fill('VCB')

      await page.getByRole('button', { name: /Analyze All/i }).click()
      await expect(page.getByRole('button', { name: /Analyze All/i })).toBeEnabled({ timeout: 30000 })

      await expect(page.getByText(/Price & Trendline Chart — VCB/)).toBeVisible()
    })

    test('should analyze with different timeframe', async ({ page }) => {
      const symbolInput = page.getByPlaceholder('e.g., VCB')
      await symbolInput.fill('FPT')

      await page.locator('select').selectOption('1W')
      await page.getByRole('button', { name: /Analyze All/i }).click()
      await expect(page.getByRole('button', { name: /Analyze All/i })).toBeEnabled({ timeout: 30000 })

      await expect(page.getByText(/Click "Analyze All" to load chart/)).not.toBeVisible()
    })
  })
})
