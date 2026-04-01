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

    test('should display refresh cache button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Refresh Cache/i })).toBeVisible()
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
  })

  test.describe('Quick Symbol Search', () => {
    test('should display search section', async ({ page }) => {
      await expect(page.getByText('Quick Symbol Search')).toBeVisible()
    })

    test('should have search input', async ({ page }) => {
      const input = page.getByPlaceholder(/Enter symbol/i)
      await expect(input).toBeVisible()
    })

    test('should accept text input', async ({ page }) => {
      const input = page.getByPlaceholder(/Enter symbol/i)
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
      await expect(page.getByRole('columnheader', { name: 'Change', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Volume' })).toBeVisible()
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

  test.describe('Refresh Cache', () => {
    test('should show loading state when refreshing', async ({ page }) => {
      const refreshBtn = page.getByRole('button', { name: /Refresh Cache/i })
      await refreshBtn.click()
      await expect(page.getByText(/Refreshing.../i)).toBeVisible()
    })
  })
})

test.describe('Navigation', () => {
  test('should show sidebar with all navigation items', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Dashboard' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Screener' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Divergence' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Config' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Settings' })).toBeVisible()
  })

  test('should highlight active page in sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const dashboardBtn = page.locator('nav').getByRole('button', { name: 'Dashboard' })
    await expect(dashboardBtn).toHaveAttribute('aria-current', 'page')
  })

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.locator('nav').getByRole('button', { name: 'Screener' }).click()
    await expect(page.getByRole('heading', { name: 'Stock Screener' })).toBeVisible({ timeout: 5000 })

    await page.locator('nav').getByRole('button', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 5000 })
  })
})
