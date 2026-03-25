import { test, expect } from '@playwright/test'

/**
 * Visual verification test with dev server (latest code)
 */

test('Visual verification with priceScaleId fix', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('trading-app_config-id', 'zion')
  })

  await page.goto('http://localhost:5174/')

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

  // Take screenshot for visual verification
  await page.screenshot({
    path: 'test-results/priceScaleId-fix-screenshot.png',
    fullPage: false
  })

  // Check legend
  const legendText = await page.locator('.flex.items-center.justify-between.mt-3 .text-xs').first().textContent()
  console.log('Legend:', legendText)

  expect(legendText).toContain('Support')

  console.log('Screenshot saved to test-results/priceScaleId-fix-screenshot.png')
  console.log('Trendlines should now align properly with candlesticks (same price scale)')
})
