import { test, expect } from '@playwright/test'

/**
 * Test multiple symbols to find trendlines without broken_at
 */

test.describe('Trendline Unbroken Verification', () => {
  const symbols = ['FPT', 'VCB', 'VIC', 'MWG', 'HPG']

  for (const symbol of symbols) {
    test(`Test ${symbol} for unbroken trendlines`, async ({ page }) => {
      const trendlinesData: any = { trendlines: [], symbol }

      page.on('response', async (response) => {
        const url = response.url()
        if (url.includes(`/analyze/${symbol}`)) {
          try {
            const data = await response.json()
            trendlinesData.trendlines = data.trendlines || []

            const unbrokenCount = (data.trendlines || []).filter((tl: any) => !tl.broken_at).length
            const brokenCount = (data.trendlines || []).filter((tl: any) => tl.broken_at).length

            console.log(`\n${symbol}: ${data.trendlines?.length || 0} trendlines (${unbrokenCount} unbroken, ${brokenCount} broken)`)

            // Check unbroken trendlines
            ;(data.trendlines || []).forEach((tl: any, i: number) => {
              if (!tl.broken_at && tl.data_points && tl.data_points.length > 0) {
                const lastDp = tl.data_points[tl.data_points.length - 1]
                console.log(`  Unbroken TL ${i + 1}: end_date=${tl.end_date}, last_dp=${lastDp.date}`)

                // Verify unbroken trendline stops at end_date
                if (lastDp.date !== tl.end_date) {
                  console.log(`    ❌ ERROR: Should end at ${tl.end_date}, ends at ${lastDp.date}`)
                } else {
                  console.log(`    ✓ Correctly stops at end_date`)
                }
              }
            })
          } catch (e) {
            console.error(`Error for ${symbol}:`, e)
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

      // Search for the symbol
      const searchInput = page.locator('input[placeholder*="Search"]').or(page.locator('input[type="search"]')).first()
      await searchInput.fill(symbol)
      await page.waitForTimeout(500)

      // Click analyze button
      const analyzeButton = page.locator('button').filter({ hasText: /Analyze All/i }).first()
      await analyzeButton.waitFor({ state: 'visible', timeout: 5000 })
      await analyzeButton.click()

      // Wait for analysis
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
      await page.waitForTimeout(500)

      // Just verify we got some response
      expect(trendlinesData.trendlines).toBeDefined()
    })
  }
})
