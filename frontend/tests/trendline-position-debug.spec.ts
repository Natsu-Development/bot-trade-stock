import { test, expect } from '@playwright/test'

/**
 * Debug trendline position mapping with price bars
 *
 * This test checks if the trendline visually aligns with the pivot points
 * on the chart by comparing the data at specific dates.
 */

test('Debug trendline position mapping', async ({ page }) => {
  const apiData: any = {}

  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/analyze/')) {
      try {
        const data = await response.json()
        apiData.response = data
      } catch (e) {
        // ignore
      }
    }
  })

  await page.addInitScript(() => {
    localStorage.setItem('trading-app_config-id', 'zion')
  })

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

  if (apiData.response?.trendlines?.[0] && apiData.response?.price_history) {
    const tl = apiData.response.trendlines[0]
    const priceHistory = apiData.response.price_history

    console.log('\n=== POSITION MAPPING DEBUG ===')
    console.log(`Trendline: ${tl.type}`)
    console.log(`start_date: ${tl.start_date}, start_price: ${tl.start_price}`)
    console.log(`end_date: ${tl.end_date}, end_price: ${tl.end_price}`)
    console.log(`slope: ${tl.slope}`)

    // Find the index of start_date in price_history
    const startIndex = priceHistory.findIndex((p: any) => p.date === tl.start_date)
    const endIndex = priceHistory.findIndex((p: any) => p.date === tl.end_date)

    console.log(`\nPrice history indices:`)
    console.log(`  Start date "${tl.start_date}" at index: ${startIndex}`)
    console.log(`  End date "${tl.end_date}" at index: ${endIndex}`)
    console.log(`  Total price bars: ${priceHistory.length}`)

    // Check the actual price data at these indices
    if (startIndex >= 0) {
      const startBar = priceHistory[startIndex]
      console.log(`\nStart bar (index ${startIndex}):`)
      console.log(`  Date: ${startBar.date}`)
      console.log(`  Open: ${startBar.open}`)
      console.log(`  High: ${startBar.high}`)
      console.log(`  Low: ${startBar.low}`)
      console.log(`  Close: ${startBar.close}`)
      console.log(`  Trendline start_price: ${tl.start_price}`)
      console.log(`  Should match Low: ${startBar.low}`)
      console.log(`  Match: ${Math.abs(tl.start_price - startBar.low) < 0.01 ? 'YES' : 'NO - MISMATCH!'}`)
    }

    if (endIndex >= 0) {
      const endBar = priceHistory[endIndex]
      console.log(`\nEnd bar (index ${endIndex}):`)
      console.log(`  Date: ${endBar.date}`)
      console.log(`  Open: ${endBar.open}`)
      console.log(`  High: ${endBar.high}`)
      console.log(`  Low: ${endBar.low}`)
      console.log(`  Close: ${endBar.close}`)
      console.log(`  Trendline end_price: ${tl.end_price}`)
      console.log(`  Should match Low: ${endBar.low}`)
      console.log(`  Match: ${Math.abs(tl.end_price - endBar.low) < 0.01 ? 'YES' : 'NO - MISMATCH!'}`)
    }

    // Check data_points alignment
    console.log(`\n=== DATA POINTS ALIGNMENT ===`)
    console.log(`Total data_points: ${tl.data_points.length}`)

    // Find the data_point at start_date
    const startDp = tl.data_points.find((p: any) => p.date === tl.start_date)
    if (startDp) {
      console.log(`\nData point at start_date:`)
      console.log(`  date: ${startDp.date}`)
      console.log(`  price: ${startDp.price}`)
      console.log(`  Expected (Low): ${priceHistory[startIndex]?.low}`)
      console.log(`  Difference: ${Math.abs(startDp.price - priceHistory[startIndex]?.low)}`)
    }

    // Check a few data_points to see if they align with price_history indices
    console.log(`\nChecking alignment between data_points and price_history:`)
    for (let i = 0; i < Math.min(5, tl.data_points.length); i++) {
      const dp = tl.data_points[i]
      const phIndex = priceHistory.findIndex((p: any) => p.date === dp.date)
      if (phIndex >= 0) {
        console.log(`  dp[${i}]: date=${dp.date}, price=${dp.price.toFixed(2)}, ph_index=${phIndex}`)
      }
    }

    // Check if there's an index offset issue
    // The data_points might be calculated using different indices than price_history
    console.log(`\n=== INDEX OFFSET CHECK ===`)
    const firstDpDate = tl.data_points[0].date
    const firstPhDate = priceHistory[0].date
    console.log(`First data_point date: ${firstDpDate}`)
    console.log(`First price_history date: ${firstPhDate}`)
    console.log(`Match: ${firstDpDate === firstPhDate ? 'YES' : 'NO - OFFSET ISSUE!'}`)

    const lastDpDate = tl.data_points[tl.data_points.length - 1].date
    const lastPhDate = priceHistory[priceHistory.length - 1].date
    console.log(`Last data_point date: ${lastDpDate}`)
    console.log(`Last price_history date: ${lastPhDate}`)
    console.log(`Match: ${lastDpDate === lastPhDate ? 'YES' : 'NO - OFFSET ISSUE!'}`)

    // Check the bar count
    const dataPointCount = tl.data_points.length
    const priceHistoryCount = priceHistory.length
    console.log(`\ndata_points count: ${dataPointCount}`)
    console.log(`price_history count: ${priceHistoryCount}`)
    console.log(`Match: ${dataPointCount === priceHistoryCount ? 'YES' : 'NO - COUNT MISMATCH!'}`)
  }

  // Take screenshot for visual inspection
  await page.screenshot({
    path: 'test-results/position-mapping-screenshot.png',
    fullPage: false
  })

  console.log('\nScreenshot saved to test-results/position-mapping-screenshot.png')

  expect(apiData.response).toBeDefined()
})
