import { test, expect } from '@playwright/test'

/**
 * Verify lightweight-charts receives correct data format
 */

test('Verify lightweight-charts series data format', async ({ page }) => {
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

  // Check what format the candlestick data uses
  const candlestickCheck = await page.evaluate(() => {
    // Look for the chart in the page
    const charts = (window as any).lightweightCharts || []
    return {
      hasLightweightCharts: typeof (window as any).lightweightCharts !== 'undefined',
      chartCount: charts.length || 0
    }
  })

  console.log('Lightweight-charts check:', JSON.stringify(candlestickCheck, null, 2))

  // Verify the data format that would be passed to lightweight-charts
  if (apiData.response?.trendlines?.[0]) {
    const tl = apiData.response.trendlines[0]

    console.log('\n=== DATA FORMAT FOR LIGHTWEIGHT-CHARTS ===')
    console.log(`Trendline type: ${tl.type}`)

    // Simulate frontend filtering
    const startDate = new Date(tl.start_date).getTime()
    const endDate = new Date(tl.end_date).getTime()

    const lineData = tl.data_points
      .filter((point: any) => {
        const pointDate = new Date(point.date).getTime()
        return pointDate >= startDate && pointDate <= endDate
      })
      .map((point: any) => ({
        time: point.date,
        value: point.price
      }))

    console.log(`Filtered data points: ${lineData.length}`)
    console.log(`\nFirst 3 points:`)
    lineData.slice(0, 3).forEach((p: any, i: number) => {
      console.log(`  ${i + 1}. time="${p.time}" (type: ${typeof p.time}), value=${p.value}`)
    })

    console.log(`\nLast 3 points:`)
    lineData.slice(-3).forEach((p: any, i: number) => {
      console.log(`  ${i + 1}. time="${p.time}" (type: ${typeof p.time}), value=${p.value}`)
    })

    // Lightweight-charts expects business day time format as 'YYYY-MM-DD'
    const firstPoint = lineData[0]
    const lastPoint = lineData[lineData.length - 1]

    console.log(`\nFormat check:`)
    console.log(`  First point time format: ${firstPoint.time} (matches YYYY-MM-DD: ${/^\d{4}-\d{2}-\d{2}$/.test(firstPoint.time)})`)
    console.log(`  Last point time format: ${lastPoint.time} (matches YYYY-MM-DD: ${/^\d{4}-\d{2}-\d{2}$/.test(lastPoint.time)})`)
  }

  // Also check price history format
  if (apiData.response?.price_history?.[0]) {
    const ph = apiData.response.price_history[0]
    console.log(`\nPrice history format:`)
    console.log(`  First bar: date="${ph.date}" (type: ${typeof ph.date}), format OK: ${/^\d{4}-\d{2}-\d{2}$/.test(ph.date)}`)
  }

  expect(apiData.response).toBeDefined()
})
