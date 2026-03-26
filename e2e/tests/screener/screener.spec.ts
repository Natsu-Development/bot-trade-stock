import { test, expect } from '@playwright/test'
import { navigateToPage, waitForPageHeading, resetTestConfig, API_BASE, TEST_USERNAME } from '../helpers'

test.describe('Screener Page', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestConfig()
    await navigateToPage(page, 'Screener')
    await waitForPageHeading(page, 'Stock Screener')
  })

  test.describe('Page Structure', () => {
    test('should display header with title and subtitle', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Stock Screener' })).toBeVisible()
      await expect(page.getByText('Filter and discover high-momentum stocks')).toBeVisible()
    })

    test('should display Save Filter button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Save Filter/i })).toBeVisible()
    })

    test('should display live clock', async ({ page }) => {
      await expect(page.getByText(/\d{2}:\d{2}:\d{2}\s+ICT/)).toBeVisible()
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

    test('should display match logic toggle', async ({ page }) => {
      await expect(page.getByText('Match')).toBeVisible()
    })

    test('should display Apply and Reset buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Apply/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Reset/i })).toBeVisible()
    })

    test('should show active filters', async ({ page }) => {
      await expect(page.getByText('Active Filters')).toBeVisible()
    })

    test('should have Add Filter button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Add Filter/i })).toBeVisible()
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

      await expect(page.getByText(/3 filter\(s\)/)).toBeVisible()
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

    test('should display Add All button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Add All/i })).toBeVisible()
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

    test('should have select-all checkbox', async ({ page }) => {
      await page.waitForTimeout(1000)
      const headerCheckbox = page.locator('thead input[type="checkbox"]')
      await expect(headerCheckbox).toBeVisible()
    })
  })

  test.describe('Stock Selection', () => {
    test('should select individual stock', async ({ page }) => {
      await page.waitForTimeout(2000)
      const firstCheckbox = page.locator('tbody tr').first().locator('input[type="checkbox"]')
      await firstCheckbox.check()
      await expect(firstCheckbox).toBeChecked()
    })

    test('should show Add Selected button after selection', async ({ page }) => {
      await page.waitForTimeout(2000)
      const firstCheckbox = page.locator('tbody tr').first().locator('input[type="checkbox"]')
      await firstCheckbox.check()
      await expect(page.getByRole('button', { name: /Add Selected/i })).toBeVisible()
    })

    test('should select all stocks with header checkbox', async ({ page }) => {
      await page.waitForTimeout(2000)
      const headerCheckbox = page.locator('thead input[type="checkbox"]')
      await headerCheckbox.check()

      const firstRowCheckbox = page.locator('tbody tr').first().locator('input[type="checkbox"]')
      await expect(firstRowCheckbox).toBeChecked()
    })
  })

  test.describe('Save Filter Dialog', () => {
    test('should open save filter dialog', async ({ page }) => {
      await page.getByRole('button', { name: /Save Filter/i }).click()
      await expect(page.getByText('Save Filter Preset')).toBeVisible()
    })

    test('should have filter name input', async ({ page }) => {
      await page.getByRole('button', { name: /Save Filter/i }).click()
      await expect(page.getByPlaceholder(/High RS Stocks/i)).toBeVisible()
    })

    test('should close dialog on cancel', async ({ page }) => {
      await page.getByRole('button', { name: /Save Filter/i }).click()
      await expect(page.getByText('Save Filter Preset')).toBeVisible()

      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByText('Save Filter Preset')).not.toBeVisible()
    })

    test('should save a filter preset', async ({ page }) => {
      await page.getByRole('button', { name: /Save Filter/i }).first().click()
      await page.getByPlaceholder(/High RS Stocks/i).fill('E2E Test Filter')

      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: /Save Filter/i }).click()

      await expect(page.getByText('Filter saved successfully')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Add to Watchlist Dialog', () => {
    test('should open watchlist dialog when adding all stocks', async ({ page }) => {
      await page.waitForTimeout(2000)
      await page.getByRole('button', { name: /Add All/i }).click()
      await expect(page.getByText('Add to Watchlist')).toBeVisible()
    })

    test('should show bullish and bearish options', async ({ page }) => {
      await page.waitForTimeout(2000)
      await page.getByRole('button', { name: /Add All/i }).click()

      await expect(page.getByText('Bullish Watchlist')).toBeVisible()
      await expect(page.getByText('Bearish Watchlist')).toBeVisible()
    })

    test('should close watchlist dialog on cancel', async ({ page }) => {
      await page.waitForTimeout(2000)
      await page.getByRole('button', { name: /Add All/i }).click()
      await expect(page.getByText('Add to Watchlist')).toBeVisible()

      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByText('Add to Watchlist')).not.toBeVisible()
    })
  })
})
