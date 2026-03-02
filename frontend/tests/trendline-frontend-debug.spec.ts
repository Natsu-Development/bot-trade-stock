import { test, expect } from '@playwright/test'

/**
 * Trendline Frontend Rendering Debug
 *
 * Tests what the frontend actually renders to lightweight-charts
 */

test('Debug frontend trendline rendering', async ({ page }) => {
  let chartData: any = {}

  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/analyze/')) {
      const data = await response.json()
      chartData.api = data
    }
  })

  await page.addInitScript(() => {
    localStorage.setItem('trading-app_config-id', 'zion')
  })

  await page.goto('/')

  const navItems = page.locator('aside nav > div').filter({ hasText: '' })
  const divergenceNav = navItems.nth(2)
  await divergenceNav.click()
  await page.waitForTimeout(500)

  const analyzeButton = page.locator('button').filter({ hasText: /Analyze All/i }).first()
  await analyzeButton.waitFor({ state: 'visible', timeout: 5000 })
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

  // Intercept what gets passed to lightweight-charts
  const frontendData = await page.evaluate(() => {
    // We'll examine the trendline data the frontend receives
    const result = {
      trendlinesFound: false,
      sampleFiltering: null as any,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateParsingExamples: {} as any
    }

    // Simulate the frontend filtering logic
    if ((window as any).__test_trendlines) {
      result.trendlinesFound = true
      result.sampleFiltering = (window as any).__test_trendlines
    }

    // Test date parsing
    const testDate = "2025-06-23"
    const parsed = new Date(testDate)
    result.dateParsingExamples = {
      input: testDate,
      parsedDate: parsed.toISOString(),
      timestamp: parsed.getTime(),
      timezoneOffset: parsed.getTimezoneOffset()
    }

    return result
  })

  console.log('\n=== FRONTEND RENDERING DEBUG ===')
  console.log('Timezone:', frontendData.timezone)
  console.log('Date parsing example:', JSON.stringify(frontendData.dateParsingExamples, null, 2))

  // Now simulate the filtering logic that happens in PriceChart
  if (chartData.api && chartData.api.trendlines) {
    const tl = chartData.api.trendlines[0]
    console.log('\n=== SIMULATING FRONTEND FILTERING ===')
    console.log(`Trendline: ${tl.type}`)
    console.log(`start_date: ${tl.start_date}`)
    console.log(`end_date: ${tl.end_date}`)

    const startDate = new Date(tl.start_date).getTime()
    const endDate = new Date(tl.end_date).getTime()

    console.log(`\nFilter timestamps:`)
    console.log(`  startDate: ${startDate} (${new Date(startDate).toISOString()})`)
    console.log(`  endDate: ${endDate} (${new Date(endDate).toISOString()})`)

    const filteredPoints = tl.data_points
      .filter((point: any) => {
        const pointDate = new Date(point.date).getTime()
        return pointDate >= startDate && pointDate <= endDate
      })

    console.log(`\nFiltered points: ${filteredPoints.length} / ${tl.data_points.length}`)
    console.log(`First filtered point:`, filteredPoints[0])
    console.log(`Last filtered point:`, filteredPoints[filteredPoints.length - 1])

    // Check if start/end dates are in the filtered points
    const startPoint = filteredPoints.find((p: any) => p.date === tl.start_date)
    const endPoint = filteredPoints.find((p: any) => p.date === tl.end_date)

    console.log(`\nStart point in filtered:`, startPoint ? 'YES' : 'NO')
    if (startPoint) {
      console.log(`  Price: ${startPoint.price}, Expected: ${tl.start_price}, Diff: ${Math.abs(startPoint.price - tl.start_price)}`)
    }

    console.log(`End point in filtered:`, endPoint ? 'YES' : 'NO')
    if (endPoint) {
      console.log(`  Price: ${endPoint.price}, Expected: ${tl.end_price}, Diff: ${Math.abs(endPoint.price - tl.end_price)}`)
    }
  }

  // Take screenshot
  await page.screenshot({
    path: 'test-results/frontend-rendering-screenshot.png',
    fullPage: false
  })
  console.log('\nScreenshot saved to test-results/frontend-rendering-screenshot.png')
})
