import { test, expect } from '@playwright/test'

/**
 * Trendline Debug Tests
 *
 * These tests capture and log the actual trendline data to debug rendering issues.
 * Run with: yarn test trendline-debug
 */

test.describe('Trendline Debug', () => {
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

    await page.waitForTimeout(1000)
  })

  test('Capture trendline data from API response', async ({ page }) => {
    // Intercept API responses
    const apiData: any = {}

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/analyze/')) {
        try {
          const data = await response.json()
          apiData.response = data

          // Log trendline data
          if (data.signals) {
            const trendlines = data.signals
              .filter((s: any) => s.trendline)
              .map((s: any) => s.trendline)

            console.log('=== TRENDLINE DATA FROM API ===')
            console.log(`Total trendlines: ${trendlines.length}`)
            trendlines.forEach((tl: any, i: number) => {
              console.log(`\nTrendline ${i + 1}:`)
              console.log(`  Type: ${tl.type}`)
              console.log(`  Start Price: ${tl.start_price}`)
              console.log(`  End Price: ${tl.end_price}`)
              console.log(`  Start Date: ${tl.start_date}`)
              console.log(`  End Date: ${tl.end_date}`)
              console.log(`  Slope: ${tl.slope}`)
              console.log(`  Current Line Price: ${tl.current_line_price}`)
            })

            // Calculate expected price differences
            if (trendlines.length > 0) {
              const tl = trendlines[0]
              const startDate = new Date(tl.start_date)
              const endDate = new Date(tl.end_date)
              const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)

              console.log(`\n=== CALCULATION DEBUG ===`)
              console.log(`Days between start and end: ${daysDiff}`)
              console.log(`Price difference: ${tl.end_price - tl.start_price}`)
              console.log(`Slope from API: ${tl.slope}`)
              console.log(`Expected daily slope (price diff / days): ${(tl.end_price - tl.start_price) / daysDiff}`)

              // What the frontend would calculate
              const frontendPrice = tl.start_price + (tl.slope * daysDiff)
              console.log(`Frontend calculated end price: ${frontendPrice}`)
              console.log(`Actual end price: ${tl.end_price}`)
              console.log(`Difference: ${Math.abs(frontendPrice - tl.end_price)}`)
            }
          }
        } catch (e) {
          console.error('Error parsing API response:', e)
        }
      }
    })

    // Wait for chart to load
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(1000)

    // Check if we got data
    expect(apiData.response).toBeDefined()
  })

  test('Capture price history data', async ({ page }) => {
    const apiData: any = {}

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/analyze/')) {
        try {
          const data = await response.json()
          apiData.response = data

          if (data.price_history && data.price_history.length > 0) {
            console.log('=== PRICE HISTORY DATA ===')
            console.log(`Total bars: ${data.price_history.length}`)
            console.log(`First bar: ${JSON.stringify(data.price_history[0])}`)
            console.log(`Last bar: ${JSON.stringify(data.price_history[data.price_history.length - 1])}`)

            // Check date format and spacing
            const dates = data.price_history.map((p: any) => p.date)
            console.log(`\nFirst 5 dates:`, dates.slice(0, 5))
            console.log(`Last 5 dates:`, dates.slice(-5))

            // Check for date gaps
            const gaps: number[] = []
            for (let i = 1; i < Math.min(10, dates.length); i++) {
              const d1 = new Date(dates[i - 1])
              const d2 = new Date(dates[i])
              const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
              gaps.push(diff)
            }
            console.log(`\nDay gaps between first 10 bars:`, gaps)
          }
        } catch (e) {
          console.error('Error parsing price history:', e)
        }
      }
    })

    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(1000)

    expect(apiData.response).toBeDefined()
  })

  test('Visual screenshot of chart with trendlines', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(1000)

    // Take a screenshot
    await page.screenshot({
      path: 'test-results/trendline-chart-screenshot.png',
      fullPage: false
    })

    console.log('Screenshot saved to test-results/trendline-chart-screenshot.png')
  })

  test('Verify lightweight-charts rendering', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(2000)

    // Inject script to inspect chart series
    const chartInfo = await page.evaluate(() => {
      // Look for trendline series in the chart
      const canvasElements = document.querySelectorAll('canvas')
      return {
        canvasCount: canvasElements.length,
        canvasSizes: Array.from(canvasElements).map(c => ({
          width: c.width,
          height: c.height
        }))
      }
    })

    console.log('=== CHART RENDER INFO ===')
    console.log(JSON.stringify(chartInfo, null, 2))

    // Check for trendline legend elements
    const legendText = await page.locator('.flex.items-center.gap-3.text-xs').allTextContents()
    console.log('\n=== LEGEND TEXT ===')
    legendText.forEach(t => console.log(t))
  })
})
