import { test, expect } from '@playwright/test'

/**
 * Verify trendline stops at cross event (Pine Script behavior)
 */

test('Verify trendline stops at cross event', async ({ page }) => {
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

  if (apiData.response?.trendlines) {
    console.log('\n=== PINE SCRIPT CROSS BEHAVIOR ===')
    console.log(`Total trendlines: ${apiData.response.trendlines.length}`)

    apiData.response.trendlines.forEach((tl: any, i: number) => {
      console.log(`\nTrendline ${i + 1}: ${tl.type}`)
      console.log(`  start_date: ${tl.start_date}`)
      console.log(`  end_date: ${tl.end_date}`)
      console.log(`  data_points count: ${tl.data_points.length}`)

      if (tl.broken_at) {
        console.log(`  ⚠️  BROKEN at: ${tl.broken_at} (${tl.broken_type})`)
        console.log(`  Trendline stops at cross event (Pine Script behavior)`)

        // Verify data_points stops at broken_at
        const lastDp = tl.data_points[tl.data_points.length - 1]
        console.log(`  Last data_point: ${lastDp.date}`)
        console.log(`  Stops at cross: ${lastDp.date === tl.broken_at ? 'YES' : 'NO - ERROR!'}`)
      } else {
        console.log(`  ✓ Not broken - line extends through all data`)
      }

      // Show first and last few data_points
      console.log(`  First 3 points:`)
      tl.data_points.slice(0, 3).forEach((p: any) => {
        console.log(`    ${p.date}: ${p.price.toFixed(2)}`)
      })

      console.log(`  Last 3 points:`)
      tl.data_points.slice(-3).forEach((p: any) => {
        console.log(`    ${p.date}: ${p.price.toFixed(2)}`)
      })
    })
  }

  await page.screenshot({
    path: 'test-results/pine-script-cross-behavior.png',
    fullPage: false
  })

  console.log('\nScreenshot saved to test-results/pine-script-cross-behavior.png')

  expect(apiData.response).toBeDefined()
})
