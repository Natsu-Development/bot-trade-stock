import { test, expect } from '@playwright/test'

/**
 * Take a visual screenshot of the trendline chart for debugging
 */

test('Screenshot trendline chart on Divergence page', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('trading-app_config-id', 'zion')
  })

  await page.goto('/')

  // Navigate to Divergence page (third nav item) - chart is at the end of Divergence page
  const navItems = page.locator('aside nav > div').filter({ hasText: '' })
  const divergenceNav = navItems.nth(2)
  await divergenceNav.click()
  await page.waitForTimeout(500)

  // Click analyze button to load the chart
  const analyzeButton = page.locator('button').filter({ hasText: /Analyze All/i }).first()
  await analyzeButton.waitFor({ state: 'visible', timeout: 5000 })
  await analyzeButton.click()

  // Wait for analysis to complete
  await page.waitForFunction(() => {
    const buttons = document.querySelectorAll('button')
    for (const btn of buttons) {
      if (btn.textContent && btn.textContent.includes('Analyze All')) {
        return !btn.textContent.includes('Analyzing')
      }
    }
    return false
  }, { timeout: 30000 })

  // Wait for the chart to load (chart is at the end of Divergence page)
  await page.waitForSelector('canvas', { timeout: 20000 })
  await page.waitForTimeout(2000)

  // Take screenshot - scroll to chart area first (at end of page)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)

  await page.screenshot({
    path: 'test-results/trendline-chart-visual.png',
    fullPage: false
  })

  console.log('Screenshot saved to test-results/trendline-chart-visual.png')

  // Get legend info
  const legendText = await page.evaluate(() => {
    const legend = document.querySelector('.flex.items-center.justify-between.mt-3 .text-xs')
    if (legend) {
      return Array.from(legend.parentElement?.children || []).map((el: any) => el.textContent?.trim())
    }
    return []
  })
  console.log('Legend info:', legendText)
})

test('Analyze trendline data on Divergence page', async ({ page }) => {
  const apiData: any = {}

  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/analyze/')) {
      try {
        const data = await response.json()
        apiData.response = data

        if (data.trendlines && data.trendlines.length > 0) {
          console.log('\n=== DASHBOARD TRENDLINE ANALYSIS ===')
          console.log(`Total trendlines: ${data.trendlines.length}`)

          data.trendlines.forEach((tl: any, i: number) => {
            console.log(`\nTrendline ${i + 1}: ${tl.type}`)
            console.log(`  start_date: ${tl.start_date} @ ${tl.start_price}`)
            console.log(`  end_date: ${tl.end_date} @ ${tl.end_price}`)
            console.log(`  broken_at: ${tl.broken_at || 'NOT SET'}`)
            console.log(`  Data points: ${tl.data_points?.length || 0}`)
            if (tl.data_points && tl.data_points.length > 0) {
              console.log(`  First dp: ${tl.data_points[0].date} @ ${tl.data_points[0].price}`)
              console.log(`  Last dp: ${tl.data_points[tl.data_points.length - 1].date} @ ${tl.data_points[tl.data_points.length - 1].price}`)

              // Check if first dp matches start_date price
              const firstDp = tl.data_points[0]
              const priceMatch = Math.abs(firstDp.price - tl.start_price) < 0.01
              console.log(`  First dp matches start_price: ${priceMatch}`)
            }
          })
        }
      } catch (e) {
        console.error('Error:', e)
      }
    }
  })

  await page.addInitScript(() => {
    localStorage.setItem('trading-app_config-id', 'zion')
  })

  await page.goto('/')

  // Navigate to Divergence page
  const navItems = page.locator('aside nav > div').filter({ hasText: '' })
  const divergenceNav = navItems.nth(2)
  await divergenceNav.click()
  await page.waitForTimeout(500)

  // Click analyze button to load the chart
  const analyzeButton = page.locator('button').filter({ hasText: /Analyze All/i }).first()
  await analyzeButton.waitFor({ state: 'visible', timeout: 5000 })
  await analyzeButton.click()

  // Wait for analysis to complete
  await page.waitForFunction(() => {
    const buttons = document.querySelectorAll('button')
    for (const btn of buttons) {
      if (btn.textContent && btn.textContent.includes('Analyze All')) {
        return !btn.textContent.includes('Analyzing')
      }
    }
    return false
  }, { timeout: 30000 })

  // Wait for chart
  await page.waitForSelector('canvas', { timeout: 20000 })
  await page.waitForTimeout(1000)

  expect(apiData.response).toBeDefined()
})
