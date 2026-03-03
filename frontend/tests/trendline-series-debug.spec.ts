import { test, expect } from '@playwright/test'

/**
 * Trendline Series Data Debug
 *
 * Intercept actual lightweight-charts series data
 */

test('Capture lightweight-charts series data', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('trading-app_config-id', 'zion')

    // Intercept lightweight-charts setData calls
    const originalAddLineSeries = (window as any).LightweightCharts?.createChart
    if (!originalAddLineSeries) {
      // Will be patched after load
      console.log('LightweightCharts not available at init')
    }
  })

  await page.goto('/')

  // Patch after page load
  await page.evaluate(() => {
    // Capture trendline data before rendering
    (window as any).__capture_trendline_data = (trendlines: any[]) => {
      const captured = trendlines.map(tl => {
        const startDate = new Date(tl.start_date).getTime()
        const endDate = new Date(tl.end_date).getTime()

        const filtered = tl.data_points
          .filter((point: any) => {
            const pointDate = new Date(point.date).getTime()
            return pointDate >= startDate && pointDate <= endDate
          })
          .map((point: any) => ({
            time: point.date,
            value: point.price
          }))

        return {
          type: tl.type,
          start_date: tl.start_date,
          end_date: tl.end_date,
          filtered_count: filtered.length,
          first_point: filtered[0],
          last_point: filtered[filtered.length - 1],
          start_price: tl.start_price,
          end_price: tl.end_price,
          all_filtered: filtered
        }
      })

      console.log('=== CAPTURED TRENDLINE DATA FOR RENDERING ===')
      console.log(JSON.stringify(captured, null, 2))

      return captured
    }
  })

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

  // Get the trendline data that was passed to the component
  const trendlineRenderData = await page.evaluate(() => {
    const result: any = { hasChart: false }

    // Look for React props/state containing trendlines
    const reactRoot = document.querySelector('#root')?._reactRootContainer?._internalRoot?.current
    if (reactRoot) {
      result.hasReactRoot = true
    }

    return result
  })

  console.log('Chart data:', JSON.stringify(trendlineRenderData, null, 2))

  await page.screenshot({
    path: 'test-results/series-debug-screenshot.png',
    fullPage: false
  })

  console.log('Screenshot saved')
})
