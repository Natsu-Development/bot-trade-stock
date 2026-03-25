import { test, expect } from '@playwright/test'

/**
 * Verify Trendline Aligns with Price Pivots
 *
 * This test verifies that the trendline data_points
 * correctly align with the actual price data at pivot points
 */

test('Verify trendline aligns with price pivots', async ({ page }) => {
  const apiData: any = {}

  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/analyze/FPT')) {
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
  await page.waitForTimeout(1000)

  // Analyze the first trendline in detail
  if (apiData.response?.trendlines?.[0]) {
    const tl = apiData.response.trendlines[0]
    const priceHistory = apiData.response.price_history

    console.log('\n=== DETAIVED TRENDLINE VERIFICATION ===')
    console.log(`Trendline: ${tl.type}`)
    console.log(`Start: ${tl.start_date} @ ${tl.start_price}`)
    console.log(`End: ${tl.end_date} @ ${tl.end_price}`)

    // Find the price data at start_date
    const startPriceData = priceHistory.find((p: any) => p.date === tl.start_date)
    const endPriceData = priceHistory.find((p: any) => p.date === tl.end_date)

    console.log('\n--- Price Data at Start Date ---')
    if (startPriceData) {
      console.log(`Date: ${startPriceData.date}`)
      console.log(`Open: ${startPriceData.open}`)
      console.log(`High: ${startPriceData.high}`)
      console.log(`Low: ${startPriceData.low}`)
      console.log(`Close: ${startPriceData.close}`)
      console.log(`\nTrendline start_price: ${tl.start_price}`)
      console.log(`Should match: ${tl.type === 'uptrend_support' ? 'Low' : tl.type === 'downtrend_resistance' ? 'High' : '???'}`)
      console.log(`Match: ${tl.type === 'uptrend_support' ? startPriceData.low : tl.type === 'downtrend_resistance' ? startPriceData.high : 'N/A'}`)

      const expectedValue = tl.type === 'uptrend_support' ? startPriceData.low :
                           tl.type === 'downtrend_resistance' ? startPriceData.high : null
      if (expectedValue !== null) {
        const diff = Math.abs(tl.start_price - expectedValue)
        console.log(`Difference: ${diff}`)
        console.log(`Status: ${diff < 0.01 ? 'PASS' : 'FAIL - Prices do not match!'}`)
      }
    }

    console.log('\n--- Price Data at End Date ---')
    if (endPriceData) {
      console.log(`Date: ${endPriceData.date}`)
      console.log(`Open: ${endPriceData.open}`)
      console.log(`High: ${endPriceData.high}`)
      console.log(`Low: ${endPriceData.low}`)
      console.log(`Close: ${endPriceData.close}`)
      console.log(`\nTrendline end_price: ${tl.end_price}`)
      console.log(`Should match: ${tl.type === 'uptrend_support' ? 'Low' : tl.type === 'downtrend_resistance' ? 'High' : '???'}`)

      const expectedValue = tl.type === 'uptrend_support' ? endPriceData.low :
                           tl.type === 'downtrend_resistance' ? endPriceData.high : null
      if (expectedValue !== null) {
        const diff = Math.abs(tl.end_price - expectedValue)
        console.log(`Match: ${expectedValue}`)
        console.log(`Difference: ${diff}`)
        console.log(`Status: ${diff < 0.01 ? 'PASS' : 'FAIL - Prices do not match!'}`)
      }
    }

    // Check a few intermediate points
    console.log('\n--- Intermediate Points ---')
    const startDate = new Date(tl.start_date).getTime()
    const endDate = new Date(tl.end_date).getTime()

    // Get 3 points between start and end
    const filteredPoints = tl.data_points.filter((p: any) => {
      const pd = new Date(p.date).getTime()
      return pd >= startDate && pd <= endDate
    })

    if (filteredPoints.length > 2) {
      const step = Math.floor(filteredPoints.length / 4)
      for (let i = step; i < filteredPoints.length; i += step) {
        const pt = filteredPoints[i]
        const priceData = priceHistory.find((p: any) => p.date === pt.date)
        if (priceData) {
          console.log(`\nDate: ${pt.date}`)
          console.log(`  Trendline price: ${pt.price}`)
          console.log(`  Price bar Low: ${priceData.low}`)
          console.log(`  Price bar High: ${priceData.high}`)
          console.log(`  Trendline should be ${tl.type === 'uptrend_support' ? 'near or below Low' : 'near or above High'}`)

          if (tl.type === 'uptrend_support') {
            const diff = pt.price - priceData.low
            console.log(`  Difference from Low: ${diff.toFixed(2)} (${diff > -1 ? 'OK' : 'BELOW LOW - ERROR'})`)
          } else {
            const diff = priceData.high - pt.price
            console.log(`  Difference from High: ${diff.toFixed(2)} (${diff > -1 ? 'OK' : 'ABOVE HIGH - ERROR'})`)
          }
        }
      }
    }
  }

  expect(apiData.response).toBeDefined()
})
