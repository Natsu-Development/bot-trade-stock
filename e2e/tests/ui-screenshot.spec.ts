import { test, expect } from '@playwright/test'

/**
 * UI Screenshot Tests
 *
 * These tests capture screenshots of the application for visual inspection.
 * Run with: yarn test playwright
 */

test.describe('UI Screenshots', () => {
  test('Dashboard page', async ({ page }) => {
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Take full page screenshot
    await page.screenshot({
      path: 'screenshots/dashboard.png',
      fullPage: true
    })
  })

  test('Username Dialog', async ({ page, context }) => {
    // Clear localStorage to show username dialog
    await context.clearCookies()
    await page.goto('/')

    // Wait for the dialog to appear
    await page.waitForSelector('text=Username', { timeout: 5000 })

    // Take screenshot
    await page.screenshot({
      path: 'screenshots/username-dialog.png'
    })
  })

  test('Screener page', async ({ page }) => {
    // Set localStorage to skip username dialog
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('trading-app_config-id', 'test-user')
    })

    // Navigate to screener
    await page.goto('/')
    await page.click('text=Screener')

    // Wait for content
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: 'screenshots/screener.png',
      fullPage: true
    })
  })

  test('Divergence page', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('trading-app_config-id', 'test-user')
    })
    await page.goto('/')
    await page.click('text=Divergence')

    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: 'screenshots/divergence.png',
      fullPage: true
    })
  })

  test('Config page', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('trading-app_config-id', 'test-user')
    })
    await page.goto('/')
    await page.click('text=Config')

    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: 'screenshots/config.png',
      fullPage: true
    })
  })

  test('Settings page', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('trading-app_config-id', 'test-user')
    })
    await page.goto('/')
    await page.click('text=Settings')

    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: 'screenshots/settings.png',
      fullPage: true
    })
  })
})

test.describe('UI Component Inspection', () => {
  test('Check sidebar navigation', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('trading-app_config-id', 'test-user')
    })
    await page.goto('/')

    // Check sidebar exists
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()

    // Check navigation items
    const navItems = page.locator('nav a, nav [role="button"], nav button')
    const count = await navItems.count()

    console.log(`Found ${count} navigation items`)

    // Screenshot sidebar
    await sidebar.screenshot({
      path: 'screenshots/sidebar.png'
    })
  })

  test('Check for console errors', async ({ page }) => {
    const errors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('trading-app_config-id', 'test-user')
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    if (errors.length > 0) {
      console.log('Console errors found:', errors)
    } else {
      console.log('No console errors detected')
    }

    expect(errors.length).toBe(0)
  })
})
