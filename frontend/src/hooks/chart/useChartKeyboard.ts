import { useEffect, useCallback } from 'react'

interface UseChartKeyboardOptions {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  goToStart: () => void
  goToEnd: () => void
  scrollLeft: () => void
  scrollRight: () => void
}

export function useChartKeyboard(controls: UseChartKeyboardOptions) {
  const { zoomIn, zoomOut, resetZoom, goToStart, goToEnd, scrollLeft, scrollRight } = controls

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input
    if ((e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA') {
      return
    }

    // Ignore if modifier keys are pressed (except for specific shortcuts)
    if (e.metaKey || e.ctrlKey) {
      // Handle Ctrl/Cmd + key combinations
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
      return
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        scrollLeft()
        break
      case 'ArrowRight':
        e.preventDefault()
        scrollRight()
        break
      case 'Home':
        e.preventDefault()
        goToStart()
        break
      case 'End':
        e.preventDefault()
        goToEnd()
        break
      case 'r':
      case 'R':
        e.preventDefault()
        resetZoom()
        break
      case '+':
      case '=':
        e.preventDefault()
        zoomIn()
        break
      case '-':
      case '_':
        e.preventDefault()
        zoomOut()
        break
    }
  }, [zoomIn, zoomOut, resetZoom, goToStart, goToEnd, scrollLeft, scrollRight])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
