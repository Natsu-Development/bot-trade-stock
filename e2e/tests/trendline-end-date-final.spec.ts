import { test, expect } from '@playwright/test'

/**
 * Final verification test for trendline end date behavior
 *
 * This test verifies:
 * 1. Trendlines WITH broken_at extend TO broken_at (where they were actually broken)
 * 2. Trendlines WITHOUT broken_at stop AT end_date (the last pivot point)
 * 3. No trendline extends to current price (today) unless broken_at is today
 */

test('Trendline end date behavior verification', async ({ page }) => {
  const testResults: any = {
    total: 0,
    broken: { count: 0, correct: 0 },
    unbroken: { count: 0, correct: 0 },
    errors: []
  }

  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/analyze/')) {
      try {
        const data = await response.json()

        if (!data.trendlines) return

        console.log('\n' + '='.repeat(80))
        console.log('TRENDLINE END DATE FINAL VERIFICATION')
        console.log('='.repeat(80))

        data.trendlines.forEach((tl: any, i: number) => {
          testResults.total++
          const hasBrokenAt = !!tl.broken_at
          const lastDp = tl.data_points?.[tl.data_points.length - 1]

          if (!lastDp) {
            testResults.errors.push(`Trendline ${i + 1}: No data points`)
            return
          }

          const expectedEnd = tl.broken_at || tl.end_date
          const isCorrect = lastDp.date === expectedEnd

          console.log(`\nTrendline ${i + 1}: ${tl.type}`)
          console.log(`  start_date: ${tl.start_date}`)
          console.log(`  end_date: ${tl.end_date}`)
          console.log(`  broken_at: ${tl.broken_at || 'NOT SET'}`)
          console.log(`  Expected end: ${expectedEnd}`)
          console.log(`  Actual end (last dp): ${lastDp.date}`)

          if (hasBrokenAt) {
            testResults.broken.count++
            // Broken trendline should extend TO broken_at
            if (isCorrect) {
              testResults.broken.correct++
              console.log(`  ✓ Correctly extends TO broken_at: ${tl.broken_at}`)
            } else {
              testResults.errors.push(`Trendline ${i + 1}: Should end at ${tl.broken_at}, not ${lastDp.date}`)
              console.log(`  ❌ ERROR: Should end at broken_at (${tl.broken_at}), not ${lastDp.date}`)
            }
          } else {
            testResults.unbroken.count++
            // Unbroken trendline should stop AT end_date
            if (isCorrect) {
              testResults.unbroken.correct++
              console.log(`  ✓ Correctly stops AT end_date: ${tl.end_date}`)
            } else {
              testResults.errors.push(`Trendline ${i + 1}: Should end at ${tl.end_date}, not ${lastDp.date}`)
              console.log(`  ❌ ERROR: Should end at end_date (${tl.end_date}), not ${lastDp.date}`)
            }
          }

          // Verify no points extend beyond expected end
          const hasPointsBeyond = tl.data_points.some((dp: any) => dp.date > expectedEnd)
          if (hasPointsBeyond) {
            const beyond = tl.data_points.filter((dp: any) => dp.date > expectedEnd).map((dp: any) => dp.date)
            testResults.errors.push(`Trendline ${i + 1}: Has ${beyond.length} points beyond ${expectedEnd}: ${beyond.slice(0, 3).join(', ')}...`)
            console.log(`  ❌ ERROR: ${beyond.length} points beyond expected end`)
          }
        })

        // Summary
        console.log('\n' + '='.repeat(80))
        console.log('SUMMARY')
        console.log('='.repeat(80))
        console.log(`Total trendlines: ${testResults.total}`)
        console.log(`Broken trendlines: ${testResults.broken.count}/${testResults.broken.correct} correct`)
        console.log(`Unbroken trendlines: ${testResults.unbroken.count}/${testResults.unbroken.correct} correct`)
        if (testResults.errors.length > 0) {
          console.log(`\nErrors: ${testResults.errors.length}`)
          testResults.errors.forEach(err => console.log(`  - ${err}`))
        }
        console.log('='.repeat(80) + '\n')
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

  // Take screenshot
  await page.screenshot({
    path: 'test-results/trendline-end-date-final.png',
    fullPage: false
  })

  // Verify all trendlines end at expected date
  const allCorrect = (testResults.broken.correct === testResults.broken.count) &&
                     (testResults.unbroken.correct === testResults.unbroken.count)

  expect(allCorrect).toBe(true)
})
