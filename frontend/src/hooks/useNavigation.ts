import { useState, useCallback } from 'react'
import type { Page } from '../types'

export function useNavigation(initialPage: Page = 'dashboard') {
  const [currentPage, setCurrentPage] = useState<Page>(initialPage)

  const navigate = useCallback((page: Page) => {
    setCurrentPage(page)
  }, [])

  return { currentPage, navigate }
}
