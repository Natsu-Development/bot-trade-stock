import { test, expect } from '@playwright/test'

/**
 * Trendline Visual Test
 *
 * This test visually verifies trendline rendering by:
 * 1. Opening the Divergence page
 * 2. Running analysis
 * 3. Taking screenshots with trendlines enabled/disabled
 * 4. Logging trendline data to console
 */

test.describe('Trendline Visual Test', () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage before first load
    await page.addInitScript(() => {
      localStorage.setItem('trading-app_config-id', 'zion')
    })

    // Navigate to the app
    await page.goto('/')

    // Navigate to Divergence page
    const navItems = page.locator('aside nav > div').filter({ hasText: '' })
    const divergenceNav = navItems.nth(2)
    await divergenceNav.click()
    await page.waitForTimeout(500)

    // Wait for the Analyze All button
    const analyzeButton = page.locator('button').filter({ hasText: /Analyze All/i }).first()
    await analyzeButton.waitFor({ state: 'visible', timeout: 5000 })

    // Click the button and wait for completion
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

    await page.waitForTimeout(2000)
  })

  test('Screenshot with trendlines enabled', async ({ page }) => {
    // Ensure trendlines are enabled
    const trendlineButton = page.locator('button').filter({ hasText: /Trendlines/i }).first()
    const isEnabled = await trendlineButton.evaluate(el => {
      return el.classList.contains('bg-[var(--neon-bull)]/20') ||
             el.textContent?.includes('bg-[var(--neon-bear)]/20')
    })

    if (!isEnabled) {
      await trendlineButton.click()
      await page.waitForTimeout(500)
    }

    // Take screenshot
    await page.screenshot({
      path: 'test-results/trendline-enabled.png',
      fullPage: false
    })

    console.log('Screenshot saved: test-results/trendline-enabled.png')
  })

  test('Screenshot with trendlines disabled', async ({ page }) => {
    // Disable trendlines
    const trendlineButton = page.locator('button').filter({ hasText: /Trendlines/i }).first()
    await trendlineButton.click()
    await page.waitForTimeout(500)

    // Take screenshot
    await page.screenshot({
      path: 'test-results/trendline-disabled.png',
      fullPage: false
    })

    console.log('Screenshot saved: test-results/trendline-disabled.png')
  })

  test('Log trendline data from page', async ({ page }) => {
    // Inject script to log trendline data
    const trendlineData = await page.evaluate(() => {
      // Look for trendline info in the page
      const canvas = document.querySelector('canvas')
      if (!canvas) return { error: 'No canvas found' }

      // Get legend info
      const legendElements = document.querySelectorAll('.flex.items-center.gap-3.text-xs, .flex.items-center.justify-between.mt-3 .text-xs')
      const legendText = Array.from(legendElements).map(el => el.textContent?.trim()).filter(Boolean)

      return {
        canvasFound: true,
        legendText,
        canvasSize: {
          width: canvas.width,
          height: canvas.height
        }
      }
    })

    console.log('=== PAGE TRENDLINE DATA ===')
    console.log(JSON.stringify(trendlineData, null, 2))
  })

  test('Verify trendline toggle functionality', async ({ page }) => {
    const trendlineButton = page.locator('button').filter({ hasText: /Trendlines/i }).first()

    // Get initial state
    const initialState = await trendlineButton.textContent()

    // Toggle off
    await trendlineButton.click()
    await page.waitForTimeout(500)
    const offState = await trendlineButton.textContent()

    // Toggle on
    await trendlineButton.click()
    await page.waitForTimeout(500)
    const onState = await trendlineButton.textContent()

    console.log('Trendline button states:')
    console.log('  Initial:', initialState)
    console.log('  Off:', offState)
    console.log('  On:', onState)

    // Verify states are different
    expect(offState).not.toBe(onState)
  })
})
