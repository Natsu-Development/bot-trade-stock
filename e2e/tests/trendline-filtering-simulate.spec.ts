import { test, expect } from '@playwright/test'

/**
 * Simulate frontend filtering and verify exact data passed to lightweight-charts
 */

test('Simulate exact frontend trendline filtering', async ({ page }) => {
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
  await page.waitForTimeout(1000)

  if (apiData.response?.trendlines?.[0]) {
    const tl = apiData.response.trendlines[0]
    const priceHistory = apiData.response.price_history

    console.log('\n=== FRONTEND FILTERING SIMULATION ===')

    // Simulate the exact filtering from PriceChart.tsx
    const startDate = new Date(tl.start_date).getTime()

    const lineData = tl.data_points
      .filter((point: any) => {
        const pointDate = new Date(point.date).getTime()
        return pointDate >= startDate
      })
      .map((point: any) => ({
        time: point.date,
        value: point.price,
      }))

    console.log(`Trendline: ${tl.type}`)
    console.log(`start_date: ${tl.start_date}`)
    console.log(`end_date: ${tl.end_date}`)
    console.log(`\nOriginal data_points: ${tl.data_points.length}`)
    console.log(`Filtered lineData: ${lineData.length}`)

    console.log(`\nFirst 3 filtered points (what goes to lightweight-charts):`)
    lineData.slice(0, 3).forEach((p: any, i: number) => {
      console.log(`  [${i}] time="${p.time}", value=${p.value.toFixed(2)}`)
    })

    console.log(`\nLast 3 filtered points:`)
    lineData.slice(-3).forEach((p: any, i: number) => {
      console.log(`  [${lineData.length - 3 + i}] time="${p.time}", value=${p.value.toFixed(2)}`)
    })

    // Verify the first point matches start_date and start_price
    const firstPoint = lineData[0]
    console.log(`\nFirst point verification:`)
    console.log(`  time: ${firstPoint.time}`)
    console.log(`  Expected: ${tl.start_date}`)
    console.log(`  Match: ${firstPoint.time === tl.start_date ? 'YES' : 'NO!'}`)
    console.log(`  value: ${firstPoint.value}`)
    console.log(`  Expected start_price: ${tl.start_price}`)
    console.log(`  Match: ${Math.abs(firstPoint.value - tl.start_price) < 0.01 ? 'YES' : 'NO!'}`)

    // Find the price bar at start_date to verify alignment
    const startBar = priceHistory.find((p: any) => p.date === tl.start_date)
    if (startBar) {
      console.log(`\nPrice bar at start_date:`)
      console.log(`  Low: ${startBar.low}`)
      console.log(`  High: ${startBar.high}`)
      console.log(`  Close: ${startBar.close}`)
      console.log(`  Trendline value: ${firstPoint.value}`)
      console.log(`  Trendline should be at Low for support: ${startBar.low}`)
      console.log(`  Difference: ${Math.abs(firstPoint.value - startBar.low).toFixed(2)}`)
    }

    // Check if there's a date format issue
    console.log(`\n=== DATE FORMAT CHECK ===`)
    console.log(`Date format in lineData[0]: "${firstPoint.time}" (type: ${typeof firstPoint.time})`)
    console.log(`Date format in priceHistory[0]: "${priceHistory[0].date}" (type: ${typeof priceHistory[0].date})`)
    console.log(`lightweight-charts format: Should be "YYYY-MM-DD" string`)

    // Verify the lineData and priceHistory have matching date ranges
    const lineDataDates = new Set(lineData.map((p: any) => p.time))
    const priceHistoryDates = new Set(priceHistory.map((p: any) => p.date))

    const lineDataFirst = lineData[0].time
    const lineDataLast = lineData[lineData.length - 1].time
    const priceFirst = priceHistory[0].date
    const priceLast = priceHistory[priceHistory.length - 1].date

    console.log(`\n=== DATE RANGE COMPARISON ===`)
    console.log(`lineData range: ${lineDataFirst} to ${lineDataLast}`)
    console.log(`priceHistory range: ${priceFirst} to ${priceLast}`)
    console.log(`lineData starts at: ${lineDataFirst}`)
    console.log(`priceHistory starts at: ${priceFirst}`)
    console.log(`Offset: lineData starts ${lineDataDates.has(priceFirst) ? 'AT' : 'AFTER'} first price bar`)

    // Count how many lineData points exist before start_date (should be 0)
    const pointsBeforeStart = tl.data_points.filter((p: any) => {
      const pd = new Date(p.date).getTime()
      return pd < startDate
    })
    console.log(`\nPoints BEFORE start_date (excluded by filter): ${pointsBeforeStart.length}`)
    if (pointsBeforeStart.length > 0) {
      console.log(`  First excluded: ${pointsBeforeStart[0].date}`)
      console.log(`  Last excluded: ${pointsBeforeStart[pointsBeforeStart.length - 1].date}`)
    }
  }

  await page.screenshot({
    path: 'test-results/filtering-simulation-screenshot.png',
    fullPage: false
  })

  console.log('\nScreenshot saved')

  expect(apiData.response).toBeDefined()
})
