import { Page, expect } from '@playwright/test'

export const TEST_USERNAME = 'e2e_test_user'
export const API_BASE = 'http://localhost:8080'

export async function navigateToPage(page: Page, pageName: 'Dashboard' | 'Screener' | 'Divergence' | 'Config' | 'Settings') {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const nav = page.locator('nav')
  await expect(nav).toBeVisible()
  await nav.getByRole('button', { name: pageName }).click()
}

export async function waitForPageHeading(page: Page, heading: string, timeout = 10000) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout })
}

export async function resetTestConfig() {
  await fetch(`${API_BASE}/config/${TEST_USERNAME}`, { method: 'DELETE' }).catch(() => {})
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
