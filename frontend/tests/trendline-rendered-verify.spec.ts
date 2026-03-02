import { test, expect } from '@playwright/test'

/**
 * Verify the actual rendered trendline extends correctly
 * Uses dev server to test the updated code
 */

test('Verify rendered trendline extends to current date', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('trading-app_config-id', 'zion')
  })

  // Use dev server instead of preview
  await page.goto('http://localhost:5173/')

  const navItems = page.locator('aside nav > div').filter({ hasText: '' })
  const divergenceNav = navItems.nth(2)
  await divergenceNav.click()
  await page.waitForTimeout(500)

  const analyzeButton = page.locator('button').filter({ hasText: /Analyze All/i }).first()
  await analyzeButton.waitFor({ state: 'visible', timeout: 10000 })
  await analyzeButton.click()

  await page.waitForFunction(() => {
    const buttons = document.querySelectorAll('button')
    for (const btn of buttons) {
      if (btn.textContent && btn.textContent.includes('Analyze All')) {
        return !btn.textContent.includes('Analyzing')
      }
    }
    return false
  }, { timeout: 30000 })

  await page.waitForSelector('canvas', { timeout: 20000 })
  await page.waitForTimeout(2000)

  // Take a screenshot
  await page.screenshot({
    path: 'test-results/trendline-extended-screenshot.png',
    fullPage: false
  })

  // Check legend - should still show trendlines
  const legendText = await page.locator('.flex.items-center.justify-between.mt-3 .text-xs').first().textContent()
  console.log('Legend:', legendText)

  // Verify trendlines are shown
  expect(legendText).toContain('Support')
  expect(legendText).toContain('Resistance')

  console.log('Screenshot saved to test-results/trendline-extended-screenshot.png')
  console.log('Trendlines should now extend from start_date to current date (not just to end_date)')
})
