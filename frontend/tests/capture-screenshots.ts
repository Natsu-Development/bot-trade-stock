#!/usr/bin/env node
/**
 * Quick Screenshot Capture Script
 *
 * Usage: yarn capture-screenshots
 *
 * This script starts the dev server and captures screenshots of all pages
 * for visual inspection and debugging.
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright'

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = './screenshots'

const pages = [
  { name: 'dashboard', url: '/', needsAuth: true },
  { name: 'screener', url: '/', needsAuth: true, clickNav: 'Screener' },
  { name: 'divergence', url: '/', needsAuth: true, clickNav: 'Divergence' },
  { name: 'config', url: '/', needsAuth: true, clickNav: 'Config' },
  { name: 'settings', url: '/', needsAuth: true, clickNav: 'Settings' },
]

async function captureScreenshots() {
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null

  try {
    console.log('🚀 Starting screenshot capture...')
    console.log(`📁 Screenshots will be saved to: ${SCREENSHOT_DIR}`)

    // Launch browser
    browser = await chromium.launch({
      headless: true,
    })
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    })
    page = await context.newPage()

    // Listen for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
        console.log(`❌ Console Error: ${msg.text()}`)
      }
    })

    for (const pageConfig of pages) {
      console.log(`\n📸 Capturing: ${pageConfig.name}`)

      // Set auth if needed
      if (pageConfig.needsAuth) {
        await page.goto(BASE_URL)
        await page.evaluate(() => {
          localStorage.setItem('trading-app_config-id', 'test-user')
        })
      }

      // Navigate to page
      await page.goto(BASE_URL, { waitUntil: 'networkidle' })

      // Click navigation if specified
      if (pageConfig.clickNav) {
        const navSelector = `text=${pageConfig.clickNav}`
        try {
          await page.click(navSelector, { timeout: 5000 })
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(500) // Wait for animations
        } catch (e) {
          console.log(`⚠️  Could not click nav: ${pageConfig.clickNav}`)
        }
      }

      // Take screenshot
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${pageConfig.name}.png`,
        fullPage: true,
      })

      console.log(`✅ Saved: ${SCREENSHOT_DIR}/${pageConfig.name}.png`)
    }

    // Capture console errors summary
    if (errors.length > 0) {
      console.log(`\n⚠️  Found ${errors.length} console errors`)
    } else {
      console.log('\n✅ No console errors detected')
    }

    console.log('\n✨ Screenshot capture complete!')
    console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}/`)
    console.log('Share these screenshots with Claude to identify UI issues.')

  } catch (error) {
    console.error('❌ Error capturing screenshots:', error)
    process.exit(1)
  } finally {
    await page?.close()
    await context?.close()
    await browser?.close()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  captureScreenshots()
}

export { captureScreenshots }
