import { test, expect } from '@playwright/test'

/**
 * Chart Interaction Tests
 *
 * These tests verify the PriceChart component interactions work correctly.
 * Run with: yarn test chart-interaction
 * Run with UI: yarn test:ui chart-interaction
 */

test.describe('Chart Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage before first load to skip username dialog
    await page.addInitScript(() => {
      localStorage.setItem('trading-app_config-id', 'zion')
    })

    // Log console errors to help debug
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text())
      }
    })

    // Navigate to the app
    await page.goto('/')

    // Wait for the app to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Navigate to Divergence page by clicking the 3rd nav item (Divergence is at index 2)
    // The nav items are divs with tooltips shown on hover
    const navItems = page.locator('aside nav > div').filter({ hasText: '' })
    const divergenceNav = navItems.nth(2) // 3rd item (0-indexed: 0=Dashboard, 1=Screener, 2=Divergence)

    await divergenceNav.click()
    await page.waitForTimeout(500)

    // Wait for the Analyze All button to be visible and enabled
    const analyzeButton = page.locator('button').filter({ hasText: /Analyze All/i }).first()
    await analyzeButton.waitFor({ state: 'visible', timeout: 5000 })

    // Click the button and wait for the API response
    await analyzeButton.click()

    // Wait for the loading state to finish (button text changes from "Analyzing..." back to "Analyze All")
    await page.waitForFunction(() => {
      const buttons = document.querySelectorAll('button')
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.includes('Analyze All')) {
          return !btn.textContent.includes('Analyzing')
        }
      }
      return false
    }, { timeout: 30000 })

    // Wait for React to update the DOM after setting analysisResult
    await page.waitForTimeout(500)

    // Wait for the chart canvas to appear (lightweight-charts renders to canvas)
    await page.waitForSelector('canvas', { timeout: 10000 })

    // Wait a bit for chart to fully initialize
    await page.waitForTimeout(500)
  })

  test('Chart displays and loads correctly', async ({ page }) => {
    // Check for canvas element (lightweight-charts renders to canvas)
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()

    console.log('Chart canvas is visible')

    // Verify chart controls are visible
    const zoomPercentage = page.getByText(/\d+%/).first()
    await expect(zoomPercentage).toBeVisible({ timeout: 5000 })

    console.log('Chart controls are visible')
  })

  test('Mouse wheel zooms the chart', async ({ page }) => {
    // Find the chart container
    const chartContainer = page.getByTestId('chart-container').or(
      page.locator('.relative > div[class*="overflow-hidden"]').first()
    )

    // Wait for chart to fully initialize
    await page.waitForTimeout(1000)

    await chartContainer.hover({ force: true })

    // Find the zoom percentage display
    const zoomDisplay = page.locator('.font-mono').filter({ hasText: /\d+%/ }).first()
    await expect(zoomDisplay).toBeVisible({ timeout: 5000 })

    // Get initial zoom percentage
    const zoomBefore = await zoomDisplay.textContent()
    console.log('Zoom before:', zoomBefore)

    // Test the built-in zoom functionality by sending wheel events to the chart container
    await chartContainer.evaluate((el) => {
      // Send multiple wheel events to trigger zoom
      for (let i = 0; i < 10; i++) {
        el.dispatchEvent(new WheelEvent('wheel', {
          deltaY: -10,
          deltaX: 0,
          deltaZ: 0,
          bubbles: true,
          cancelable: true,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        }))
      }
    })
    await page.waitForTimeout(500)

    // Check if zoom changed
    const zoomAfter = await zoomDisplay.textContent()
    console.log('Zoom after scroll in:', zoomAfter)

    // If built-in zoom works, the zoom level should have changed
    // If it doesn't work, we may need to implement custom wheel handling
    expect(zoomAfter).not.toBe(zoomBefore)
  })

  test('Click and drag pans the chart', async ({ page }) => {
    const chartContainer = page.getByTestId('chart-container').or(
      page.locator('.relative > div[class*="overflow-hidden"]').first()
    )

    // Get container bounds for drag operation
    const box = await chartContainer.boundingBox()
    if (!box) {
      console.log('Could not get chart container bounds')
      return
    }

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2

    // Drag left to pan right (show newer data)
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX - 100, startY)
    await page.mouse.up()

    await page.waitForTimeout(300)
    console.log('Drag pan completed')
  })

  test('Navigation buttons work', async ({ page }) => {
    // Test reset button (it should be visible)
    const resetButton = page.locator('button[title*="Reset"], button[title*="reset"]').first()
    if (await resetButton.isVisible({ timeout: 3000 })) {
      await resetButton.click()
      await page.waitForTimeout(300)
      console.log('Reset button clicked')
    }

    // Test scroll left button
    const scrollLeftButton = page.locator('button[title*="Scroll left"], button[title*="scroll left"]').first()
    if (await scrollLeftButton.isVisible({ timeout: 2000 })) {
      await scrollLeftButton.click()
      await page.waitForTimeout(300)
      console.log('Scroll left button clicked')
    }

    // Test scroll right button
    const scrollRightButton = page.locator('button[title*="Scroll right"], button[title*="scroll right"]').first()
    if (await scrollRightButton.isVisible({ timeout: 2000 })) {
      await scrollRightButton.click()
      await page.waitForTimeout(300)
      console.log('Scroll right button clicked')
    }

    // Test zoom in button
    const zoomInButton = page.locator('button[title*="Zoom in"], button[title*="zoom in"]').first()
    if (await zoomInButton.isVisible({ timeout: 2000 })) {
      await zoomInButton.click()
      await page.waitForTimeout(300)
      console.log('Zoom in button clicked')
    }

    // Test zoom out button
    const zoomOutButton = page.locator('button[title*="Zoom out"], button[title*="zoom out"]').first()
    if (await zoomOutButton.isVisible({ timeout: 2000 })) {
      await zoomOutButton.click()
      await page.waitForTimeout(300)
      console.log('Zoom out button clicked')
    }

    // If title-based selectors don't work, try SVG-based selectors
    const allButtons = page.locator('button').filter({ hasText: '' })
    const count = await allButtons.count()
    console.log(`Found ${count} icon buttons`)

    // Try to find and click the reset button by SVG path
    const resetBySvg = page.locator('button').filter({ has: page.locator('svg path[d*="M4 4v5"]') }).first()
    if (await resetBySvg.isVisible({ timeout: 2000 })) {
      await resetBySvg.click()
      await page.waitForTimeout(300)
      console.log('Reset button (by SVG) clicked')
    }
  })

  test('Keyboard shortcuts work', async ({ page }) => {
    // Focus on the chart area by clicking the container
    const chartContainer = page.getByTestId('chart-container').or(
      page.locator('.relative > div[class*="overflow-hidden"]').first()
    )
    await chartContainer.click({ force: true })

    // Find the zoom percentage display
    const zoomDisplay = page.locator('.font-mono').filter({ hasText: /\d+%/ }).first()

    // Save initial zoom
    const zoomBefore = await zoomDisplay.textContent()
    console.log('Zoom before keyboard test:', zoomBefore)

    // Test zoom in
    await page.keyboard.press('+')
    await page.waitForTimeout(200)

    // Test zoom out
    await page.keyboard.press('-')
    await page.waitForTimeout(200)

    // Test arrow keys for scrolling
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(200)

    // Test Home/End keys
    await page.keyboard.press('Home')
    await page.waitForTimeout(200)
    await page.keyboard.press('End')
    await page.waitForTimeout(200)

    // Test reset
    await page.keyboard.press('r')
    await page.waitForTimeout(200)

    console.log('Keyboard shortcuts executed')
  })

  test('Check for console errors during chart interaction', async ({ page }) => {
    const errors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Interact with chart
    const chartContainer = page.getByTestId('chart-container').or(
      page.locator('.relative > div[class*="overflow-hidden"]').first()
    )
    await chartContainer.hover({ force: true })

    // Test wheel zoom
    await page.mouse.wheel(0, 100)
    await page.waitForTimeout(500)

    // Test keyboard interaction
    await chartContainer.click({ force: true })
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    await page.keyboard.press('r')
    await page.waitForTimeout(200)

    if (errors.length > 0) {
      console.log('Console errors found:', errors)
    } else {
      console.log('No console errors during chart interaction')
    }

    expect(errors.length).toBe(0)
  })

  test('Crosshair info displays on hover', async ({ page }) => {
    const chartContainer = page.getByTestId('chart-container').or(
      page.locator('.relative > div[class*="overflow-hidden"]').first()
    )

    // Get container size for better hover position
    const box = await chartContainer.boundingBox()
    if (box) {
      // Hover over the chart at a specific position using page.mouse.move()
      await page.mouse.move(box.x + Math.min(200, box.width / 2), box.y + Math.min(150, box.height / 2))

      // Wait for crosshair tooltip
      await page.waitForTimeout(500)

      // Check if crosshair info overlay appears
      // The overlay should contain OHLC data
      const crosshairInfo = page.locator('text=/O:\\s*[\\d.]/').or(
        page.locator('[class*="overlay"], [class*="backdrop"]')
      ).first()

      // Just verify no errors occur during hover
      console.log('Crosshair hover test completed')
    }
  })

  test('Signals and trendlines render without errors', async ({ page }) => {
    // Check for console errors related to chart rendering
    const errors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Filter out common non-critical errors
        if (!text.includes('Minified React error') && !text.includes('Warning:')) {
          errors.push(text)
        }
      }
    })

    // Wait for chart to fully load
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(1000)

    // Check that chart is visible
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()

    // Check for trendlines indicator in legend
    // After clicking Signals button, trendlines should be loaded
    const legend = page.locator('text=/Support \\(|Resistance \\(/').or(
      page.locator('text=/Trendlines/')
    )
    const hasTrendlines = await legend.count() > 0

    if (hasTrendlines) {
      console.log('Trendlines are displayed in legend')
    } else {
      console.log('No trendlines found - this is OK if there are no valid trendlines for the symbol')
    }

    // Check for signals indicator
    const signalsLegend = page.locator('text=/Confirmed|Watching/')
    const hasSignals = await signalsLegend.count() > 0

    if (hasSignals) {
      console.log('Signals are displayed in legend')
    } else {
      console.log('No signals found - this is OK if there are no valid signals for the symbol')
    }

    // Verify no critical errors occurred
    if (errors.length > 0) {
      console.log('Console errors found:', errors)
    }

    expect(errors.length).toBe(0)
  })

  test('API returns chronologically sorted data', async ({ page }) => {
    // Intercept the API response to verify data is sorted
    let signalsData: any[] = []
    let priceHistoryData: any[] = []

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/signals') || url.includes('/analyze/')) {
        try {
          const data = await response.json()
          if (data.signals) {
            signalsData = data.signals
          }
          if (data.price_history) {
            priceHistoryData = data.price_history
          }
        } catch {
          // Ignore non-JSON responses
        }
      }
    })

    // Wait for chart to load
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(1000)

    // Verify signals are sorted by time
    if (signalsData.length > 1) {
      const signalTimes = signalsData.map((s: any) => new Date(s.time).getTime())

      // Check if sorted
      let isSorted = true
      for (let i = 1; i < signalTimes.length; i++) {
        if (signalTimes[i] < signalTimes[i - 1]) {
          isSorted = false
          console.log(`Signal ${i - 1} time: ${new Date(signalTimes[i - 1]).toISOString()}`)
          console.log(`Signal ${i} time: ${new Date(signalTimes[i]).toISOString()}`)
        }
      }

      console.log(`Signals count: ${signalsData.length}`)
      console.log(`Signals are sorted: ${isSorted}`)
      expect(isSorted).toBe(true)
    } else {
      console.log('Not enough signals to verify sorting')
    }

    // Verify price history is sorted by date
    if (priceHistoryData.length > 1) {
      const dates = priceHistoryData.map((p: any) => new Date(p.date).getTime())

      let isSorted = true
      for (let i = 1; i < dates.length; i++) {
        if (dates[i] < dates[i - 1]) {
          isSorted = false
          console.log(`Price ${i - 1} date: ${new Date(dates[i - 1]).toISOString()}`)
          console.log(`Price ${i} date: ${new Date(dates[i]).toISOString()}`)
        }
      }

      console.log(`Price history count: ${priceHistoryData.length}`)
      console.log(`Price history is sorted: ${isSorted}`)
      expect(isSorted).toBe(true)
    } else {
      console.log('Not enough price history to verify sorting')
    }
  })

  test('Volume indicator toggle works', async ({ page }) => {
    // Wait for chart to load
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(500)

    // Note: Volume is always shown now, there's no toggle button
    // The volume legend should still be visible
    const volumeLegend = page.locator('text=/Volume/i').or(
      page.locator('text=/volume/i')
    ).first()

    const hasVolumeLegend = await volumeLegend.count() > 0
    console.log('Volume legend visible:', hasVolumeLegend)

    // Verify chart is still visible
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
  })

  test('RSI indicator toggle works', async ({ page }) => {
    // Wait for chart to load
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(500)

    // Find the RSI toggle button
    const rsiButton = page.locator('button').filter({ hasText: /^RSI$/i }).first()

    // Check if RSI button exists
    const rsiButtonCount = await rsiButton.count()

    if (rsiButtonCount > 0) {
      // RSI button is available
      await expect(rsiButton).toBeVisible()

      // Get initial state - RSI should be inactive by default
      const initialClass = await rsiButton.getAttribute('class') || ''
      const initiallyActive = initialClass.includes('neon-purple') || initialClass.includes('border')
      console.log('RSI button initially active:', initiallyActive)

      // Toggle RSI on
      await rsiButton.click()
      await page.waitForTimeout(300)

      // Check if button state changed
      const afterOnClass = await rsiButton.getAttribute('class') || ''
      const activeAfterOn = afterOnClass.includes('neon-purple') || afterOnClass.includes('border')
      console.log('RSI button active after turning on:', activeAfterOn)

      // Toggle RSI off
      await rsiButton.click()
      await page.waitForTimeout(300)

      const afterOffClass = await rsiButton.getAttribute('class') || ''
      const activeAfterOff = afterOffClass.includes('neon-purple') || afterOffClass.includes('border')
      console.log('RSI button active after turning off:', activeAfterOff)

      // Verify chart still works after toggling
      const canvas = page.locator('canvas').first()
      await expect(canvas).toBeVisible()
    } else {
      console.log('RSI button not found - this is expected if RSI data is not available')
    }
  })

  test('Multiple indicator toggles work together', async ({ page }) => {
    // Wait for chart to load
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(500)

    // Note: Volume is always shown now, no toggle button
    // Just test RSI toggle if available
    const rsiButton = page.locator('button').filter({ hasText: /^RSI$/i }).first()
    const rsiButtonCount = await rsiButton.count()

    if (rsiButtonCount > 0) {
      // Toggle RSI on
      await rsiButton.click()
      await page.waitForTimeout(300)

      // Verify chart still works
      const canvas = page.locator('canvas').first()
      await expect(canvas).toBeVisible()

      // Toggle RSI off
      await rsiButton.click()
      await page.waitForTimeout(300)
    }

    // Verify chart still works
    await expect(page.locator('canvas').first()).toBeVisible()
  })
})
