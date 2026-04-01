import { useState, useCallback, useEffect } from 'react'
import type { Page } from '../types'

const VALID_PAGES = new Set<Page>(['dashboard', 'screener', 'divergence', 'config', 'settings'])

function pageFromHash(): Page {
  if (typeof window === 'undefined') return 'dashboard'
  const segment = window.location.hash.replace(/^#/, '').split(/[/?]/)[0] || 'dashboard'
  return VALID_PAGES.has(segment as Page) ? (segment as Page) : 'dashboard'
}

function replaceHashForPage(page: Page) {
  const { pathname, search } = window.location
  window.history.replaceState(null, '', `${pathname}${search}#${page}`)
}

/**
 * Hash-based SPA navigation: syncs current page with `location.hash`, supports refresh and back/forward.
 */
export function useNavigation(initialPage: Page = 'dashboard') {
  const [currentPage, setCurrentPage] = useState<Page>(() =>
    typeof window !== 'undefined' ? pageFromHash() : initialPage
  )

  useEffect(() => {
    const syncFromHash = () => setCurrentPage(pageFromHash())
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.location.hash || window.location.hash === '#') {
      replaceHashForPage('dashboard')
      setCurrentPage('dashboard')
    }
  }, [])

  const navigate = useCallback((page: Page) => {
    setCurrentPage(page)
    if (typeof window !== 'undefined' && window.location.hash.slice(1) !== page) {
      window.location.hash = page
    }
  }, [])

  return { currentPage, navigate }
}
