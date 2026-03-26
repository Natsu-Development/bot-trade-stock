import { test as setup, expect } from '@playwright/test'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = `${__dirname}/../playwright/.auth/user.json`
const API_BASE = 'http://localhost:8080'

// This must match what tests expect
export const TEST_USERNAME = 'e2e_test_user'

setup('authenticate', async ({ page }) => {
  // Create config via API first (backend requires at least one symbol)
  const response = await fetch(`${API_BASE}/config/${TEST_USERNAME}`)
  if (!response.ok) {
    await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: TEST_USERNAME,
        rsi_period: 14,
        pivot_period: 5,
        lookback_day: 365,
        divergence: { range_min: 30, range_max: 70 },
        trendline: { max_lines: 5, proximity_percent: 3 },
        indices_recent: 5,
        bearish_symbols: ['VCB'],
        bullish_symbols: ['VIC'],
        telegram: { enabled: false },
      }),
    })
  }

  // Go to the app and clear any existing auth
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())

  // Refresh to trigger welcome dialog
  await page.reload()

  // Wait for welcome dialog
  await expect(page.getByRole('dialog')).toBeVisible()

  // Enter username
  await page.getByRole('textbox', { name: 'Username' }).fill(TEST_USERNAME)
  await page.getByRole('button', { name: 'Continue' }).click()

  // Wait for dialog to close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })

  // Verify we're logged in
  await expect(page.locator('nav')).toBeVisible()

  // Save authentication state
  await page.context().storageState({ path: AUTH_FILE })
})