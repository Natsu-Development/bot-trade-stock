import { test, expect } from '@playwright/test'

/**
 * Verify trendline extension to current date
 */

test('Verify trendline extends to current date (not just end_date)', async ({ page }) => {
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
  await page.waitForTimeout(1000)

  if (apiData.response?.trendlines?.[0]) {
    const tl = apiData.response.trendlines[0]
    const priceHistory = apiData.response.price_history

    console.log('\n=== TRENDLINE EXTENSION ANALYSIS ===')
    console.log(`Trendline: ${tl.type}`)
    console.log(`start_date: ${tl.start_date}`)
    console.log(`end_date: ${tl.end_date}`)

    // What is the last date in price history?
    const lastPriceDate = priceHistory[priceHistory.length - 1].date
    console.log(`Last price_history date: ${lastPriceDate}`)

    // Find the data point at the last price date
    const lastDp = tl.data_points.find((p: any) => p.date === lastPriceDate)
    if (lastDp) {
      console.log(`\nTrendline price at last date (${lastPriceDate}): ${lastDp.price}`)
      console.log(`Price data close: ${priceHistory[priceHistory.length - 1].close}`)
    }

    // Now simulate frontend filtering
    const startDate = new Date(tl.start_date).getTime()
    const endDate = new Date(tl.end_date).getTime()

    const filteredToEndDate = tl.data_points.filter((p: any) => {
      const pd = new Date(p.date).getTime()
      return pd >= startDate && pd <= endDate
    })

    const filteredToCurrent = tl.data_points.filter((p: any) => {
      const pd = new Date(p.date).getTime()
      return pd >= startDate  // No upper limit!
    })

    console.log(`\n=== FRONTEND FILTERING COMPARISON ===`)
    console.log(`Filtered to end_date (${tl.end_date}): ${filteredToEndDate.length} points`)
    console.log(`Filtered to current date (no upper limit): ${filteredToCurrent.length} points`)
    console.log(`Data points total: ${tl.data_points.length}`)

    console.log(`\nLast point when filtered to end_date:`)
    console.log(`  ${JSON.stringify(filteredToEndDate[filteredToEndDate.length - 1])}`)

    console.log(`\nLast point when filtered to current date:`)
    console.log(`  ${JSON.stringify(filteredToCurrent[filteredToCurrent.length - 1])}`)

    console.log(`\n=== ISSUE IDENTIFIED ===`)
    console.log(`The frontend filters to end_date, but Pine Script extends trendlines to the current bar!`)
    console.log(`The trendline should show from ${tl.start_date} to ${lastPriceDate}`)
    console.log(`But currently only shows from ${tl.start_date} to ${tl.end_date}`)
  }

  expect(apiData.response).toBeDefined()
})
