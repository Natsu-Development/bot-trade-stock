import { test, expect } from '@playwright/test'

/**
 * Trendline broken_at Field Debug Tests
 *
 * Deep analysis of the broken_at field issue to understand why trendlines
 * are not displaying correctly with price bars
 */

test.describe('Trendline broken_at Debug', () => {
  test('Deep analysis of trendline data_points with broken_at', async ({ page }) => {
    const apiData: any = {}

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/analyze/')) {
        try {
          const data = await response.json()
          apiData.response = data

          if (data.trendlines && data.trendlines.length > 0) {
            console.log('\n' + '='.repeat(80))
            console.log('TRENDLINE BROKEN_AT DEEP ANALYSIS')
            console.log('='.repeat(80))

            // Log price history info
            if (data.price_history) {
              console.log(`\nPrice History:`)
              console.log(`  Total bars: ${data.price_history.length}`)
              console.log(`  First date: ${data.price_history[0]?.date}`)
              console.log(`  Last date: ${data.price_history[data.price_history.length - 1]?.date}`)
            }

            data.trendlines.forEach((tl: any, i: number) => {
              console.log(`\n${'─'.repeat(80)}`)
              console.log(`Trendline ${i + 1}: ${tl.type}`)
              console.log('─'.repeat(80))

              console.log(`\nMetadata:`)
              console.log(`  start_date: ${tl.start_date}`)
              console.log(`  end_date: ${tl.end_date}`)
              console.log(`  start_price: ${tl.start_price}`)
              console.log(`  end_price: ${tl.end_price}`)
              console.log(`  slope: ${tl.slope}`)
              console.log(`  broken_at: ${tl.broken_at || 'NOT SET'}`)
              console.log(`  broken_type: ${tl.broken_type || 'NOT SET'}`)

              if (tl.data_points && tl.data_points.length > 0) {
                console.log(`\nData Points (${tl.data_points.length} total):`)
                console.log(`  First data_point: ${tl.data_points[0].date} @ price=${tl.data_points[0].price}`)
                console.log(`  Last data_point: ${tl.data_points[tl.data_points.length - 1].date} @ price=${tl.data_points[tl.data_points.length - 1].price}`)

                // Verify start_date matches first data_point
                const firstDpMatchesStart = tl.data_points[0].date === tl.start_date
                console.log(`\n  Start date verification:`)
                console.log(`    start_date matches first dp: ${firstDpMatchesStart}`)
                if (!firstDpMatchesStart) {
                  console.log(`    WARNING: First dp date (${tl.data_points[0].date}) != start_date (${tl.start_date})`)
                }

                // Verify end_date or broken_at matches last data_point
                const expectedEndDate = tl.broken_at || tl.end_date
                const lastDpMatchesEnd = tl.data_points[tl.data_points.length - 1].date === expectedEndDate
                console.log(`\n  End date verification:`)
                console.log(`    Expected end (broken_at or end_date): ${expectedEndDate}`)
                console.log(`    Last dp date: ${tl.data_points[tl.data_points.length - 1].date}`)
                console.log(`    Last dp matches expected end: ${lastDpMatchesEnd}`)
                if (!lastDpMatchesEnd) {
                  console.log(`    WARNING: Last dp does not match expected end date!`)
                }

                // If broken_at is set, verify data_points stop at broken_at
                if (tl.broken_at) {
                  const brokenAtIndex = tl.data_points.findIndex((dp: any) => dp.date === tl.broken_at)
                  console.log(`\n  broken_at verification:`)
                  console.log(`    broken_at in data_points: ${brokenAtIndex >= 0}`)
                  if (brokenAtIndex >= 0) {
                    console.log(`    broken_at position: ${brokenAtIndex + 1}/${tl.data_points.length}`)

                    // Check if any data_points exist after broken_at
                    const hasPointsAfterBroken = tl.data_points.some((dp: any) => dp.date > tl.broken_at)
                    console.log(`    data_points after broken_at: ${hasPointsAfterBroken}`)
                    if (hasPointsAfterBroken) {
                      console.log(`    ERROR: Found data_points after broken_at!`)
                      const afterBroken = tl.data_points.filter((dp: any) => dp.date > tl.broken_at)
                      console.log(`    Points after broken_at: ${afterBroken.map((dp: any) => dp.date).join(', ')}`)
                    }

                    // Check if last data_point is at broken_at
                    const isLastDpAtBroken = tl.data_points[tl.data_points.length - 1].date === tl.broken_at
                    console.log(`    Last dp is at broken_at: ${isLastDpAtBroken}`)
                  } else {
                    console.log(`    ERROR: broken_at date not found in data_points!`)
                  }
                }

                // Check data_points continuity
                console.log(`\n  Data points continuity check:`)
                for (let j = 0; j < Math.min(5, tl.data_points.length); j++) {
                  const dp = tl.data_points[j]
                  console.log(`    [${j}] ${dp.date} @ ${dp.price}`)
                }
                if (tl.data_points.length > 10) {
                  console.log(`    ...`)
                  for (let j = Math.max(5, tl.data_points.length - 5); j < tl.data_points.length; j++) {
                    const dp = tl.data_points[j]
                    console.log(`    [${j}] ${dp.date} @ ${dp.price}`)
                  }
                }
              } else {
                console.log(`\n  ERROR: No data_points found!`)
              }
            })

            console.log('\n' + '='.repeat(80))
          } else {
            console.log('No trendlines in response')
          }
        } catch (e) {
          console.error('Error parsing API response:', e)
        }
      }
    })

    await page.addInitScript(() => {
      localStorage.setItem('trading-app_config-id', 'zion')
    })

    await page.goto('/')

    // Navigate to divergence page
    const navItems = page.locator('aside nav > div').filter({ hasText: '' })
    const divergenceNav = navItems.nth(2)
    await divergenceNav.click()
    await page.waitForTimeout(500)

    // Click analyze button
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

    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(1000)

    // Verify we got data
    expect(apiData.response).toBeDefined()

    // Additional: Check frontend rendering
    const frontendData = await page.evaluate(() => {
      // Try to get trendline data from window or component
      const chartContainer = document.querySelector('[data-testid="chart-container"]')
      if (chartContainer) {
        const canvas = chartContainer.querySelector('canvas')
        return {
          hasCanvas: !!canvas,
          canvasWidth: canvas?.width,
          canvasHeight: canvas?.height
        }
      }
      return { hasCanvas: false }
    })

    console.log('\nFrontend rendering:', JSON.stringify(frontendData, null, 2))
  })

  test('Verify broken_at trendline stops at correct point', async ({ page }) => {
    let trendlineWithBrokenAt: any = null

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/analyze/')) {
        try {
          const data = await response.json()
          if (data.trendlines) {
            // Find a trendline with broken_at
            trendlineWithBrokenAt = data.trendlines.find((tl: any) => tl.broken_at)
            if (trendlineWithBrokenAt) {
              console.log('\nFound trendline with broken_at:')
              console.log(`  Type: ${trendlineWithBrokenAt.type}`)
              console.log(`  start_date: ${trendlineWithBrokenAt.start_date}`)
              console.log(`  end_date: ${trendlineWithBrokenAt.end_date}`)
              console.log(`  broken_at: ${trendlineWithBrokenAt.broken_at}`)
              console.log(`  Data points count: ${trendlineWithBrokenAt.data_points?.length || 0}`)

              if (trendlineWithBrokenAt.data_points) {
                const brokenAtDp = trendlineWithBrokenAt.data_points.find((dp: any) => dp.date === trendlineWithBrokenAt.broken_at)
                console.log(`  broken_at in data_points: ${!!brokenAtDp}`)

                // Check if data_points extend beyond broken_at
                const pointsAfter = trendlineWithBrokenAt.data_points.filter((dp: any) => dp.date > trendlineWithBrokenAt.broken_at)
                console.log(`  data_points after broken_at: ${pointsAfter.length}`)
                if (pointsAfter.length > 0) {
                  console.log(`  ERROR: Data points after broken_at:`)
                  pointsAfter.forEach((dp: any) => console.log(`    - ${dp.date}`))
                }
              }
            } else {
              console.log('No trendline with broken_at found in response')
            }
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

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'test-results/trendline-broken-at-visual.png',
      fullPage: false
    })

    console.log('\nScreenshot saved to test-results/trendline-broken-at-visual.png')
  })

  test('Compare trendline data_points with price_history for alignment', async ({ page }) => {
    const analysisData: any = {}

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/analyze/')) {
        try {
          const data = await response.json()
          analysisData.data = data

          if (data.price_history && data.trendlines) {
            console.log('\n' + '='.repeat(80))
            console.log('ALIGNMENT VERIFICATION: Trendline data_points vs Price History')
            console.log('='.repeat(80))

            const priceMap = new Map<string, any>()
            data.price_history.forEach((p: any) => {
              priceMap.set(p.date, p)
            })

            console.log(`\nPrice history: ${data.price_history.length} bars`)
            console.log(`Price history range: ${data.price_history[0]?.date} to ${data.price_history[data.price_history.length - 1]?.date}`)

            data.trendlines.forEach((tl: any, tlIdx: number) => {
              console.log(`\n--- Trendline ${tlIdx + 1}: ${tl.type} ---`)

              if (tl.data_points && tl.data_points.length > 0) {
                // Check if each data_point date exists in price_history
                let allDpsInPriceHistory = true
                let missingDps: string[] = []

                tl.data_points.forEach((dp: any) => {
                  if (!priceMap.has(dp.date)) {
                    allDpsInPriceHistory = false
                    missingDps.push(dp.date)
                  }
                })

                console.log(`  Data points: ${tl.data_points.length}`)
                console.log(`  All data_points in price_history: ${allDpsInPriceHistory}`)
                if (missingDps.length > 0) {
                  console.log(`  Missing from price_history (${missingDps.length}):`)
                  missingDps.forEach(d => console.log(`    - ${d}`))
                }

                // Check price alignment at key points
                console.log(`\n  Price alignment check:`)

                // At start_date
                if (priceMap.has(tl.start_date)) {
                  const priceAtStart = priceMap.get(tl.start_date)
                  const dpAtStart = tl.data_points.find((dp: any) => dp.date === tl.start_date)
                  if (dpAtStart) {
                    console.log(`    start_date ${tl.start_date}:`)
                    console.log(`      Price history low: ${priceAtStart.low}`)
                    console.log(`      Data point price: ${dpAtStart.price}`)
                    console.log(`      Difference: ${Math.abs(dpAtStart.price - priceAtStart.low).toFixed(4)}`)
                  }
                }

                // At end_date or broken_at
                const endDate = tl.broken_at || tl.end_date
                if (priceMap.has(endDate)) {
                  const priceAtEnd = priceMap.get(endDate)
                  const dpAtEnd = tl.data_points.find((dp: any) => dp.date === endDate)
                  if (dpAtEnd) {
                    console.log(`    end_date ${endDate}:`)
                    console.log(`      Price history: ${JSON.stringify({ open: priceAtEnd.open, high: priceAtEnd.high, low: priceAtEnd.low, close: priceAtEnd.close })}`)
                    console.log(`      Data point price: ${dpAtEnd.price}`)
                  }
                }
              }
            })

            console.log('\n' + '='.repeat(80))
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

    expect(analysisData.data).toBeDefined()
  })
})
