import { useState, useCallback, useEffect } from 'react'
import type { Page } from '../types'

const VALID_PAGES = new Set<Page>(['dashboard', 'screener', 'analyze', 'config', 'settings'])

/** dashboard lives at '/', every other page at '/<page>'. */
function pathForPage(page: Page): string {
  return page === 'dashboard' ? '/' : `/${page}`
}

function pageFromPath(): Page {
  if (typeof window === 'undefined') return 'dashboard'
  const segment = window.location.pathname.replace(/^\/+/, '').split(/[/?]/)[0] || 'dashboard'
  return VALID_PAGES.has(segment as Page) ? (segment as Page) : 'dashboard'
}

/**
 * Path-based SPA navigation: the current page is the first path segment
 * (`/screener`, `/analyze`, …; `/` = dashboard). Uses the History API so real
 * links work — Ctrl/Cmd-click opens a new tab — while in-app clicks pushState
 * without a reload. Back/forward + refresh land on the right page.
 */
export function useNavigation(initialPage: Page = 'dashboard') {
  const [currentPage, setCurrentPage] = useState<Page>(() =>
    typeof window !== 'undefined' ? pageFromPath() : initialPage
  )

  useEffect(() => {
    const syncFromPath = () => setCurrentPage(pageFromPath())
    window.addEventListener('popstate', syncFromPath)
    return () => window.removeEventListener('popstate', syncFromPath)
  }, [])

  const navigate = useCallback((page: Page) => {
    setCurrentPage(page)
    if (typeof window === 'undefined') return
    const target = `${pathForPage(page)}${window.location.search}`
    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.history.pushState(null, '', target)
    }
  }, [])

  return { currentPage, navigate }
}
