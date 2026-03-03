import { test, expect } from '@playwright/test'

/**
 * Trendline Data Debug Tests
 *
 * Captures detailed trendline data_points to debug alignment issues
 */

test.describe('Trendline Data Debug', () => {
  test('Capture and analyze trendline data_points', async ({ page }) => {
    // Set up response handler BEFORE any navigation
    const apiData: any = {}

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/analyze/')) {
        try {
          const data = await response.json()
          apiData.response = data

          if (data.trendlines && data.trendlines.length > 0) {
            console.log('\n=== TRENDLINE ANALYSIS ===')
            console.log(`Total trendlines: ${data.trendlines.length}`)

            // Also log price history info
            if (data.price_history) {
              console.log(`\nPrice history bars: ${data.price_history.length}`)
              console.log(`First price bar date: ${data.price_history[0]?.date}`)
              console.log(`Last price bar date: ${data.price_history[data.price_history.length - 1]?.date}`)
            }

            data.trendlines.forEach((tl: any, i: number) => {
              console.log(`\n--- Trendline ${i + 1}: ${tl.type} ---`)
              console.log(`Start: ${tl.start_date} @ ${tl.start_price}`)
              console.log(`End: ${tl.end_date} @ ${tl.end_price}`)
              console.log(`Slope: ${tl.slope}`)

              if (tl.data_points && tl.data_points.length > 0) {
                console.log(`Data points: ${tl.data_points.length}`)
                console.log(`First dp: ${tl.data_points[0].date} @ ${tl.data_points[0].price}`)
                console.log(`Last dp: ${tl.data_points[tl.data_points.length - 1].date} @ ${tl.data_points[tl.data_points.length - 1].price}`)

                // Find the data point that matches start_date
                const startDp = tl.data_points.find((dp: any) => dp.date === tl.start_date)
                const endDp = tl.data_points.find((dp: any) => dp.date === tl.end_date)

                console.log(`\nStart date data point match:`)
                if (startDp) {
                  console.log(`  Found: ${startDp.date} @ ${startDp.price}`)
                  console.log(`  Expected start_price: ${tl.start_price}`)
                  console.log(`  Difference: ${Math.abs(startDp.price - tl.start_price)}`)
                } else {
                  console.log(`  NOT FOUND in data_points!`)
                }

                console.log(`\nEnd date data point match:`)
                if (endDp) {
                  console.log(`  Found: ${endDp.date} @ ${endDp.price}`)
                  console.log(`  Expected end_price: ${tl.end_price}`)
                  console.log(`  Difference: ${Math.abs(endDp.price - tl.end_price)}`)
                } else {
                  console.log(`  NOT FOUND in data_points!`)
                }

                // Check if any data_points match price history dates
                if (data.price_history) {
                  const priceDates = new Set(data.price_history.map((p: any) => p.date))
                  const matchingDates = tl.data_points.filter((dp: any) => priceDates.has(dp.date))
                  console.log(`\nData points matching price history dates: ${matchingDates.length}/${tl.data_points.length}`)
                }
              } else {
                console.log(`No data_points!`)
              }
            })
          } else {
            console.log('No trendlines in response')
          }
        } catch (e) {
          console.error('Error parsing API response:', e)
        }
      }
    })

    // Now navigate and trigger analysis
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

    // Verify we got data
    expect(apiData.response).toBeDefined()
  })

  test('Verify trendline dates match price history dates', async ({ page }) => {
    const apiData: any = {}

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/analyze/')) {
        try {
          const data = await response.json()
          apiData.response = data

          if (data.price_history && data.trendlines) {
            console.log('\n=== DATE MATCHING VERIFICATION ===')

            const priceDates = new Set(data.price_history.map((p: any) => p.date))
            console.log(`Price history date range: ${data.price_history[0]?.date} to ${data.price_history[data.price_history.length - 1]?.date}`)

            let allMatch = true
            data.trendlines.forEach((tl: any, i: number) => {
              console.log(`\nTrendline ${i + 1} (${tl.type}):`)
              console.log(`  start_date: ${tl.start_date}`)
              console.log(`  end_date: ${tl.end_date}`)

              const startMatch = priceDates.has(tl.start_date)
              const endMatch = priceDates.has(tl.end_date)

              console.log(`  start_date in price_history: ${startMatch}`)
              console.log(`  end_date in price_history: ${endMatch}`)

              if (!startMatch || !endMatch) {
                allMatch = false
                console.log(`  ERROR: Trendline dates not in price_history!`)
              }

              // Check data_points
              if (tl.data_points && tl.data_points.length > 0) {
                const firstDp = tl.data_points[0]
                const lastDp = tl.data_points[tl.data_points.length - 1]
                console.log(`  First dp: ${firstDp.date} (in price_history: ${priceDates.has(firstDp.date)})`)
                console.log(`  Last dp: ${lastDp.date} (in price_history: ${priceDates.has(lastDp.date)})`)
              }
            })

            console.log(`\nOverall date matching: ${allMatch ? 'PASS' : 'FAIL'}`)
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

    expect(apiData.response).toBeDefined()
  })

  test('Screenshot with trendline overlay info', async ({ page }) => {
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

    // Get trendline info before screenshot
    const legendText = await page.evaluate(() => {
      const legend = document.querySelector('.flex.items-center.justify-between.mt-3 .text-xs')
      return legend?.textContent || 'No legend found'
    })
    console.log('Legend:', legendText)

    await page.screenshot({
      path: 'test-results/trendline-debug-screenshot.png',
      fullPage: false
    })

    console.log('Screenshot saved')
  })
})
