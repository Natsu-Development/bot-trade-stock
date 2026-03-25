import { test, expect } from '@playwright/test'

/**
 * Trendline End Date Stop Tests
 *
 * Verify that trendlines without broken_at stop at end_date,
 * and trendlines with broken_at extend to broken_at.
 */

test.describe('Trendline End Date Behavior', () => {
  test('Trendlines stop at end_date when not broken, extend to broken_at when broken', async ({ page }) => {
    const analysisData: any = {
      trendlines: [],
      priceHistory: []
    }

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/analyze/')) {
        try {
          const data = await response.json()
          analysisData.trendlines = data.trendlines || []
          analysisData.priceHistory = data.price_history || []

          console.log('\n' + '='.repeat(80))
          console.log('TRENDLINE END DATE BEHAVIOR VERIFICATION')
          console.log('='.repeat(80))

          if (data.trendlines && data.trendlines.length > 0) {
            data.trendlines.forEach((tl: any, i: number) => {
              console.log(`\n--- Trendline ${i + 1}: ${tl.type} ---`)
              console.log(`  start_date: ${tl.start_date}`)
              console.log(`  end_date: ${tl.end_date}`)
              console.log(`  broken_at: ${tl.broken_at || 'NOT SET (unbroken)'}`)

              if (tl.data_points && tl.data_points.length > 0) {
                const lastDp = tl.data_points[tl.data_points.length - 1]
                console.log(`  Last data_point: ${lastDp.date}`)

                // Verify the expected behavior:
                // - If broken_at is set, trendline should extend TO broken_at
                // - If broken_at is NOT set, trendline should stop AT end_date
                const expectedEnd = tl.broken_at || tl.end_date
                const isCorrect = lastDp.date === expectedEnd

                console.log(`  Expected end: ${expectedEnd}`)
                console.log(`  Actual end: ${lastDp.date}`)
                console.log(`  ✓ Correct: ${isCorrect}`)

                if (!isCorrect) {
                  console.log(`  ❌ ERROR: Trendline should end at ${expectedEnd}, not ${lastDp.date}`)
                }

                // Verify no data points extend beyond expected end
                const hasPointsBeyond = tl.data_points.some((dp: any) => dp.date > expectedEnd)
                if (hasPointsBeyond) {
                  console.log(`  ❌ ERROR: Found data points beyond expected end!`)
                }

                // For broken trendlines, verify broken_at is the last point
                if (tl.broken_at) {
                  const brokenIsLast = lastDp.date === tl.broken_at
                  console.log(`  broken_at is last point: ${brokenIsLast}`)
                }
              }
            })
          }

          console.log('\n' + '='.repeat(80))
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
    expect(analysisData.trendlines.length).toBeGreaterThan(0)

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'test-results/trendline-end-date-verification.png',
      fullPage: false
    })

    console.log('\nScreenshot saved to test-results/trendline-end-date-verification.png')

    // Verify the core behavior: all trendlines should end at expected date
    const allCorrect = analysisData.trendlines.every((tl: any) => {
      if (!tl.data_points || tl.data_points.length === 0) return true
      const lastDp = tl.data_points[tl.data_points.length - 1]
      const expectedEnd = tl.broken_at || tl.end_date
      return lastDp.date === expectedEnd
    })

    expect(allCorrect).toBe(true)
  })
})
