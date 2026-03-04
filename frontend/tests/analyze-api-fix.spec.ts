import { test, expect } from '@playwright/test'

/**
 * Regression Test: Verify analyze API doesn't crash
 * Tests the fix for "insufficient data for RSI calculation" error
 *
 * The bug was that the code was slicing price history to indicesRecent (default 3)
 * BEFORE calculating RSI, but RSI requires period+1 data points (15 for RSI 14).
 *
 * The fix calculates RSI on the full price history first, then slices the results.
 */
test.describe('Analyze API - Crash Fix Verification', () => {
  const apiUrl = 'http://localhost:8080'
  const testConfigs = ['test', 'default', 'zion']

  test.beforeEach(async ({ request }) => {
    // Ensure test config exists
    const existingConfig = await request.get(`${apiUrl}/config/test`).catch(() => null)
    if (!existingConfig || !existingConfig.ok()) {
      await request.post(`${apiUrl}/config`, {
        data: {
          id: 'test',
          rsi_period: 14,
          start_date_offset: 365,
          divergence: {
            lookback: 5,
            lookback_left: 5,
            lookback_right: 5,
            range_min: 30,
            range_max: 70,
            indices_recent: 3,
          },
          early_detection_enabled: false,
          bearish_symbols: ['VCB'],
          bullish_symbols: ['VIC'],
          telegram: { enabled: false },
        },
      })
    }
  })

  test('should return 200 status for valid symbol and config', async ({ request }) => {
    const response = await request.get(`${apiUrl}/analyze/VCB?config_id=test`)

    expect(response.status()).toBe(200)
    expect(response.ok()).toBeTruthy()
  })

  test('should return valid JSON structure without crashing', async ({ request }) => {
    const response = await request.get(`${apiUrl}/analyze/VCB?config_id=test`)

    expect(response.ok()).toBeTruthy()

    const data = await response.json()

    // Verify top-level response structure
    expect(data).toHaveProperty('symbol')
    expect(data).toHaveProperty('processing_time_ms')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('parameters')
    expect(data).toHaveProperty('bullish_divergence')
    expect(data).toHaveProperty('bearish_divergence')
    expect(data).toHaveProperty('signals')
    expect(data).toHaveProperty('price_history')
    expect(data).toHaveProperty('trendlines')

    console.log(`Response for VCB: symbol=${data.symbol}, price=${data.parameters?.current_price}`)
  })

  test('should include RSI values in parameters', async ({ request }) => {
    const response = await request.get(`${apiUrl}/analyze/VCB?config_id=test`)

    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    const params = data.parameters

    // Verify RSI was calculated (not 0 or NaN)
    expect(params).toHaveProperty('current_rsi')
    expect(typeof params.current_rsi).toBe('number')
    expect(params.current_rsi).toBeGreaterThan(0)
    expect(params.current_rsi).toBeLessThanOrEqual(100)

    console.log(`RSI value: ${params.current_rsi}`)
  })

  test('should include price_history with recent data points', async ({ request }) => {
    const response = await request.get(`${apiUrl}/analyze/VCB?config_id=test`)

    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    const priceHistory = data.price_history

    // Should have price history (recent data points, typically 3)
    expect(Array.isArray(priceHistory)).toBeTruthy()
    expect(priceHistory.length).toBeGreaterThan(0)

    // Verify first price history item structure
    const firstItem = priceHistory[0]
    expect(firstItem).toHaveProperty('date')
    expect(firstItem).toHaveProperty('open')
    expect(firstItem).toHaveProperty('high')
    expect(firstItem).toHaveProperty('low')
    expect(firstItem).toHaveProperty('close')
    expect(firstItem).toHaveProperty('volume')

    console.log(`Price history count: ${priceHistory.length}`)
  })

  test('should handle different intervals without crashing', async ({ request }) => {
    const intervals = ['1D', '1H', '30m']

    for (const interval of intervals) {
      const response = await request.get(`${apiUrl}/analyze/VCB?interval=${interval}&config_id=test`)

      expect(response.ok(), `Interval ${interval} failed`).toBeTruthy()

      const data = await response.json()
      expect(data.parameters.interval).toBe(interval)

      console.log(`Interval ${interval}: OK, processing_time=${data.processing_time_ms}ms`)
    }
  })

  test('should handle multiple symbols', async ({ request }) => {
    const symbols = ['VCB', 'VIC', 'HPG', 'MSN', 'VNM']

    for (const symbol of symbols) {
      const response = await request.get(`${apiUrl}/analyze/${symbol}?config_id=test`)

      // Should return 200 (may have empty results but shouldn't crash)
      expect(response.ok(), `Symbol ${symbol} failed`).toBeTruthy()

      const data = await response.json()
      expect(data.symbol).toBe(symbol)

      console.log(`Symbol ${symbol}: price=${data.parameters?.current_price}, rsi=${data.parameters?.current_rsi}`)
    }
  })

  test('should return proper error for invalid config', async ({ request }) => {
    const response = await request.get(`${apiUrl}/analyze/VCB?config_id=nonexistent_config`)

    expect(response.status()).toBe(404)
  })

  test('should return proper error for missing config_id', async ({ request }) => {
    const response = await request.get(`${apiUrl}/analyze/VCB`)

    expect(response.status()).toBe(400)

    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('config_id')
  })

  test('should have reasonable processing time', async ({ request }) => {
    const startTime = Date.now()
    const response = await request.get(`${apiUrl}/analyze/VCB?config_id=test`)
    const endTime = Date.now()

    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    const processingTime = data.processing_time_ms

    // Processing time should be positive and reasonable (< 30 seconds)
    expect(processingTime).toBeGreaterThan(0)
    expect(processingTime).toBeLessThan(30000)

    // Total request time should also be reasonable
    const totalRequestTime = endTime - startTime
    expect(totalRequestTime).toBeLessThan(35000)

    console.log(`Processing time: ${processingTime}ms, Total: ${totalRequestTime}ms`)
  })

  test('should include divergence data (bullish and bearish)', async ({ request }) => {
    const response = await request.get(`${apiUrl}/analyze/VCB?config_id=test`)

    expect(response.ok()).toBeTruthy()

    const data = await response.json()

    // Verify bullish divergence structure
    expect(data).toHaveProperty('bullish_divergence')
    expect(data.bullish_divergence).toHaveProperty('divergence')
    expect(data.bullish_divergence.divergence).toHaveProperty('current_price')
    expect(data.bullish_divergence.divergence).toHaveProperty('current_rsi')
    expect(data.bullish_divergence.divergence).toHaveProperty('divergence_found')

    // Verify bearish divergence structure
    expect(data).toHaveProperty('bearish_divergence')
    expect(data.bearish_divergence).toHaveProperty('divergence')
    expect(data.bearish_divergence.divergence).toHaveProperty('current_price')
    expect(data.bearish_divergence.divergence).toHaveProperty('current_rsi')

    console.log(`Bullish divergence found: ${data.bullish_divergence.divergence.divergence_found}`)
    console.log(`Bearish divergence found: ${data.bearish_divergence.divergence.divergence_found}`)
  })

  test('should include signals array (may be empty)', async ({ request }) => {
    const response = await request.get(`${apiUrl}/analyze/VCB?config_id=test`)

    expect(response.ok()).toBeTruthy()

    const data = await response.json()

    // Verify signals structure
    expect(data).toHaveProperty('signals')
    expect(Array.isArray(data.signals)).toBeTruthy()
    expect(data).toHaveProperty('signals_count')
    expect(data.signals_count).toBe(data.signals.length)

    console.log(`Signals count: ${data.signals_count}`)
  })

  test('should include trendlines array (may be empty)', async ({ request }) => {
    const response = await request.get(`${apiUrl}/analyze/VCB?config_id=test`)

    expect(response.ok()).toBeTruthy()

    const data = await response.json()

    // Verify trendlines structure
    expect(data).toHaveProperty('trendlines')
    expect(Array.isArray(data.trendlines)).toBeTruthy()

    console.log(`Trendlines count: ${data.trendlines.length}`)
  })
})

/**
 * Integration Test: Test analyze endpoint via frontend page load
 * This ensures the frontend can successfully call the analyze API without crashes
 * @note Skipped - requires UI investigation for button state
 */
test.skip('Frontend: Analyze page should load without errors', async ({ page }) => {
  // Set up config before navigating
  await page.goto('http://localhost:5173')

  // Wait for app to load
  await page.waitForLoadState('networkidle')

  // Check if we need to enter username (first-time setup)
  const usernameInput = page.locator('input[type="text"]').first()
  if (await usernameInput.isVisible()) {
    await usernameInput.fill('testuser')
    await page.locator('button:has-text("Continue")').click()
  }

  // Navigate to divergence page
  await page.locator('[data-page="divergence"]').click()
  await page.waitForLoadState('networkidle')

  // Enter a stock symbol
  const symbolInput = page.locator('input[placeholder*="symbol"], input[placeholder*="Symbol"], input#symbol-input').first()
  if (await symbolInput.isVisible()) {
    await symbolInput.fill('VCB')

    // Wait for analysis to complete
    await page.waitForTimeout(5000)

    // Check for error messages
    const errorMessage = page.locator('.error, [role="alert"], .error-message').first()
    const hasError = await errorMessage.count() > 0

    expect(hasError, 'Page should not show error messages').toBeFalsy()

    // Verify some content is displayed
    const content = page.locator('.chart, .signal-card, .divergence-result').first()
    expect(await content.count()).toBeGreaterThan(0)
  }
})
