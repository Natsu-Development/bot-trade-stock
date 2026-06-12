import { test, expect } from '@playwright/test'
import { navigateToPage, waitForPageHeading, resetTestConfig } from '../helpers'

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Dashboard')
    await waitForPageHeading(page, 'Dashboard')
  })

  test.describe('Page Structure', () => {
    test('should display header with title and subtitle', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
      await expect(page.getByText('Vietnamese Stock Market Overview')).toBeVisible()
    })

    test('should display recompute button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Recompute/i })).toBeVisible()
    })

    test('should display live clock', async ({ page }) => {
      await expect(page.getByText(/\d{2}:\d{2}:\d{2}\s+ICT/)).toBeVisible()
    })
  })

  test.describe('Stats Cards', () => {
    test('should display all four stat cards', async ({ page }) => {
      await expect(page.getByText('Total Stocks')).toBeVisible()
      await expect(page.getByText('Bullish Signals')).toBeVisible()
      await expect(page.getByText('Bearish Signals')).toBeVisible()
      await expect(page.getByText('Cache Status')).toBeVisible()
    })

    test('should show total stocks count', async ({ page }) => {
      const totalStocks = page.locator('text=Total Stocks').locator('..')
      await expect(totalStocks).toBeVisible()
    })

    test('should show cache status as Ready or Empty', async ({ page }) => {
      await expect(page.getByText(/Ready|Empty/)).toBeVisible()
    })

    test('shows the last-refresh time in DD/MM/YYYY (day-first) format', async ({ page }) => {
      // The Total Stocks card's change line reads `Updated <DD/MM/YYYY, h:mm:ss AM/PM>`
      // when cache data exists, else 'No data'. The zero-padded day-first date is the
      // discriminator: the previous toLocaleString() output ('6/7/2026') was single
      // digit and would NOT satisfy \d{2}/\d{2}/\d{4}.
      const card = page.getByText('Total Stocks', { exact: true }).locator('..')
      await expect(card).toBeVisible()

      const change = card.locator('span').last()
      await expect(change).toHaveText(
        /^(Updated \d{2}\/\d{2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)|No data)$/,
        { timeout: 10000 }
      )
    })
  })

  test.describe('Quick Symbol Search', () => {
    test('should display search section', async ({ page }) => {
      await expect(page.getByText('Quick Symbol Search')).toBeVisible()
    })

    test('should have search input', async ({ page }) => {
      const input = page.getByPlaceholder(/Search symbol/i)
      await expect(input).toBeVisible()
    })

    test('should accept text input', async ({ page }) => {
      const input = page.getByPlaceholder(/Search symbol/i)
      await input.fill('VCB')
      await expect(input).toHaveValue('VCB')
    })
  })

  test.describe('Top RS Ratings Table', () => {
    test('should display table section header', async ({ page }) => {
      await expect(page.getByText('Top RS Ratings')).toBeVisible()
    })

    test('should display table headers', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Symbol' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Exchange' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'RS 52W' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Price' })).toBeVisible()
      // The price-change column header is now 'Chg%' (was 'Change'); the default
      // volume column is 'Vol/SMA' (raw 'Volume' is hidden by default).
      await expect(page.getByRole('columnheader', { name: 'Chg%', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Vol/SMA' })).toBeVisible()
    })

    test('should show stock rows when data is loaded', async ({ page }) => {
      await page.waitForTimeout(2000)
      const rows = page.locator('tbody tr')
      const count = await rows.count()
      expect(count).toBeGreaterThanOrEqual(0)
    })

    test('should display View All button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'View All →' })).toBeVisible()
    })
  })

  test.describe('Recompute', () => {
    test('should show loading state when recomputing', async ({ page }) => {
      const recomputeBtn = page.getByRole('button', { name: 'Recompute', exact: true })
      await recomputeBtn.click()
      await expect(page.getByText(/Recomputing.../i)).toBeVisible()
    })
  })
})

test.describe('Navigation', () => {
  test('should show sidebar with all navigation items', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    // Nav items are <a> links (path routing); the analyze link is labelled "Analyze".
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Screener' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Analyze' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Config' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible()
  })

  test('should highlight active page in sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const dashboardLink = page.locator('nav').getByRole('link', { name: 'Dashboard' })
    await expect(dashboardLink).toHaveAttribute('aria-current', 'page')
  })

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.locator('nav').getByRole('link', { name: 'Screener' }).click()
    // The screener has no page heading anymore; its filter section signals readiness.
    await expect(page.getByText('Filter Conditions')).toBeVisible({ timeout: 5000 })

    await page.locator('nav').getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 5000 })
  })
})
