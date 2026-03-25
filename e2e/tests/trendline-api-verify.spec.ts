import { test, expect } from '@playwright/test'

/**
 * API Test: Verify trendline data structure and values
 * Tests the /analyze/:symbol endpoint to ensure trendlines are returned correctly
 */
test('API: Verify trendline data has valid slope and data points', async ({ request }) => {
  const symbol = 'VCB'
  const apiUrl = 'http://localhost:8080'

  // Call the analyze API
  const response = await request.get(`${apiUrl}/analyze/${symbol}?interval=1D&config_id=zion`)

  expect(response.ok()).toBeTruthy()

  const data = await response.json()

  console.log('API Response structure:', JSON.stringify(data, null, 2))

  // Verify trendlines array exists
  expect(data).toHaveProperty('trendlines')
  const trendlines = data.trendlines as Array<{
    type: string
    data_points: Array<{ date: string; price: number }>
    start_price: number
    end_price: number
    start_date: string
    end_date: string
    slope: number
  }>

  console.log(`Found ${trendlines.length} trendlines`)

  // If we have trendlines, verify their structure
  if (trendlines.length > 0) {
    for (const trendline of trendlines) {
      console.log(`\nTrendline type: ${trendline.type}`)

      // Verify required fields
      expect(trendline).toHaveProperty('type')
      expect(trendline).toHaveProperty('data_points')
      expect(trendline).toHaveProperty('start_price')
      expect(trendline).toHaveProperty('end_price')
      expect(trendline).toHaveProperty('slope')

      // Verify data points is an array
      expect(Array.isArray(trendline.data_points)).toBeTruthy()
      console.log(`  Data points count: ${trendline.data_points.length}`)

      // Verify we have at least 2 data points (start and end)
      expect(trendline.data_points.length).toBeGreaterThanOrEqual(2)

      // Verify data points have valid structure
      for (const point of trendline.data_points) {
        expect(point).toHaveProperty('date')
        expect(point).toHaveProperty('price')
        expect(typeof point.price).toBe('number')
        expect(point.price).toBeGreaterThan(0)
        console.log(`    ${point.date}: ${point.price}`)
      }

      // Verify slope is a number
      expect(typeof trendline.slope).toBe('number')
      console.log(`  Slope: ${trendline.slope}`)

      // Verify first data point matches start price approximately
      const firstPoint = trendline.data_points[0]
      const lastPoint = trendline.data_points[trendline.data_points.length - 1]

      console.log(`  First point: ${firstPoint.price}, Start price: ${trendline.start_price}`)
      console.log(`  Last point: ${lastPoint.price}, End price: ${trendline.end_price}`)

      // Allow small floating point differences
      expect(Math.abs(firstPoint.price - trendline.start_price)).toBeLessThan(0.01)
      expect(Math.abs(lastPoint.price - trendline.end_price)).toBeLessThan(0.01)

      // Verify prices change in expected direction based on slope
      if (trendline.slope !== 0) {
        const priceChange = lastPoint.price - firstPoint.price
        const expectedDirection = trendline.slope > 0 ? 1 : -1
        const actualDirection = priceChange >= 0 ? 1 : -1

        console.log(`  Price change: ${priceChange}, Slope direction: ${expectedDirection}`)

        // For support lines (uptrend), price should increase
        // For resistance lines (downtrend), price should decrease
        if (trendline.type === 'uptrend_support') {
          expect(priceChange).toBeGreaterThan(0)
        } else if (trendline.type === 'downtrend_resistance') {
          expect(priceChange).toBeLessThan(0)
        }
      }
    }

    console.log('\n✓ All trendline data is valid')
  } else {
    console.log('No trendlines found - this is acceptable if no pivots were detected')
  }
})

/**
 * API Test: Verify trendline data points are calculated correctly
 * Uses VCB stock which typically has good trendline data
 */
test('API: Verify trendline price calculations are consistent', async ({ request }) => {
  const symbol = 'VCB'
  const apiUrl = 'http://localhost:8080'

  const response = await request.get(`${apiUrl}/analyze/${symbol}?interval=1D&config_id=zion`)

  expect(response.ok()).toBeTruthy()

  const data = await response.json()
  const trendlines = data.trendlines as Array<{
    type: string
    data_points: Array<{ date: string; price: number }>
    slope: number
  }>

  if (trendlines.length > 0) {
    for (const trendline of trendlines) {
      const points = trendline.data_points

      if (points.length >= 3) {
        // Verify price progression is consistent with slope
        const priceChanges: number[] = []

        for (let i = 1; i < points.length; i++) {
          const change = points[i].price - points[i - 1].price
          priceChanges.push(change)
        }

        // All price changes should have the same sign (or be zero)
        const firstChange = priceChanges[0]
        const allSameDirection = priceChanges.every(
          (change) => Math.sign(change) === Math.sign(firstChange) || change === 0
        )

        console.log(`Trendline ${trendline.type}:`)
        console.log(`  Price changes: ${priceChanges.map((c) => c.toFixed(4)).join(', ')}`)
        console.log(`  Slope: ${trendline.slope}`)
        console.log(`  All same direction: ${allSameDirection}`)

        expect(allSameDirection).toBeTruthy()
      }
    }
  }
})

/**
 * API Test: Verify price_history is returned
 */
test('API: Verify price_history is returned for chart rendering', async ({ request }) => {
  const symbol = 'VCB'
  const apiUrl = 'http://localhost:8080'

  const response = await request.get(`${apiUrl}/analyze/${symbol}?interval=1D&config_id=zion`)

  expect(response.ok()).toBeTruthy()

  const data = await response.json()

  // Verify price_history exists
  expect(data).toHaveProperty('price_history')
  const priceHistory = data.price_history as Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>

  console.log(`Price history count: ${priceHistory.length}`)

  // Verify we have price history data
  expect(Array.isArray(priceHistory)).toBeTruthy()
  expect(priceHistory.length).toBeGreaterThan(0)

  // Verify first and last items have valid structure
  const first = priceHistory[0]
  expect(first).toHaveProperty('date')
  expect(first).toHaveProperty('open')
  expect(first).toHaveProperty('high')
  expect(first).toHaveProperty('low')
  expect(first).toHaveProperty('close')
  expect(first).toHaveProperty('volume')

  console.log(`First date: ${first.date}`)
  console.log(`Last date: ${priceHistory[priceHistory.length - 1].date}`)
})
