import { test, expect } from '@playwright/test'

/**
 * Trendline Behavior Final Verification Test
 *
 * This test verifies the correct trendline rendering behavior:
 *
 * 1. Trendlines WITH broken_at extend TO the candle where they were broken
 *    - The trendline continues from start_date through end_date to broken_at
 *    - This shows the user exactly where the trendline was invalidated
 *
 * 2. Trendlines WITHOUT broken_at stop AT end_date (the last pivot point)
 *    - The trendline shows only the segment between start_date and end_date
 *    - This prevents trendlines from extending indefinitely to current price
 *    - Signals indicate what happened after end_date (bounce, breakout, etc.)
 *
 * This behavior ensures:
 * - No trendline extends to current price unless it was actually broken today
 * - Users can see exactly where trendlines were invalidated
 * - The signals section provides context on what happened after trendlines ended
 */

test('Trendline behavior: extends to broken_at or stops at end_date', async ({ page }) => {
  const results: any = {
    trendlines: [],
    summary: {
      total: 0,
      withBrokenAt: 0,
      withoutBrokenAt: 0,
      correct: 0
    }
  }

  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/analyze/')) {
      try {
        const data = await response.json()

        if (data.trendlines) {
          results.trendlines = data.trendlines

          console.log('\n' + '='.repeat(80))
          console.log('TRENDLINE BEHAVIOR FINAL VERIFICATION')
          console.log('='.repeat(80))

          data.trendlines.forEach((tl: any, i: number) => {
            results.summary.total++
            const hasBrokenAt = !!tl.broken_at
            const lastDp = tl.data_points?.[tl.data_points.length - 1]

            if (!hasBrokenAt) {
              results.summary.withoutBrokenAt++
            } else {
              results.summary.withBrokenAt++
            }

            console.log(`\n--- Trendline ${i + 1}: ${tl.type} ---`)
            console.log(`  start_date: ${tl.start_date}`)
            console.log(`  end_date: ${tl.end_date}`)
            console.log(`  broken_at: ${tl.broken_at || 'NOT SET'}`)

            if (lastDp) {
              const expectedEnd = tl.broken_at || tl.end_date
              const isCorrect = lastDp.date === expectedEnd

              console.log(`  Data points: ${tl.data_points.length}`)
              console.log(`  Last data_point: ${lastDp.date}`)
              console.log(`  Expected end: ${expectedEnd}`)
              console.log(`  ✓ Correct: ${isCorrect}`)

              if (isCorrect) {
                results.summary.correct++
              }

              // Verify no points beyond expected end
              const hasBeyond = tl.data_points.some((dp: any) => dp.date > expectedEnd)
              if (hasBeyond) {
                console.log(`  ❌ ERROR: Points beyond ${expectedEnd}`)
              }

              // Behavior explanation
              if (hasBrokenAt) {
                console.log(`  Behavior: Trendline extends FROM ${tl.start_date} TO ${tl.broken_at} (where broken)`)
              } else {
                console.log(`  Behavior: Trendline extends FROM ${tl.start_date} TO ${tl.end_date} (last pivot, not broken)`)
              }
            }
          })

          console.log('\n' + '='.repeat(80))
          console.log('SUMMARY')
          console.log('='.repeat(80))
          console.log(`Total trendlines: ${results.summary.total}`)
          console.log(`With broken_at: ${results.summary.withBrokenAt}`)
          console.log(`Without broken_at: ${results.summary.withoutBrokenAt}`)
          console.log(`Correct behavior: ${results.summary.correct}/${results.summary.total}`)
          console.log('='.repeat(80) + '\n')
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

  // Screenshot for visual verification
  await page.screenshot({
    path: 'test-results/trendline-behavior-final.png',
    fullPage: false
  })

  console.log('Screenshot saved to test-results/trendline-behavior-final.png')

  // Verify all trendlines have correct behavior
  expect(results.summary.correct).toBe(results.summary.total)
  expect(results.summary.total).toBeGreaterThan(0)

  // Verify no trendline extends to current date unless broken today
  const today = new Date().toISOString().split('T')[0]
  const extendsToToday = results.trendlines.some((tl: any) => {
    const lastDp = tl.data_points?.[tl.data_points.length - 1]
    return lastDp && lastDp.date === today && tl.broken_at !== today
  })

  expect(extendsToToday).toBe(false)
})
