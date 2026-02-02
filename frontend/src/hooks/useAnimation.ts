import { useEffect, useRef } from 'react'

export function useAnimation(delay = 0) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const element = ref.current
    const timeout = setTimeout(() => {
      element.style.opacity = '1'
      element.style.transform = 'translateY(0)'
    }, delay)

    return () => clearTimeout(timeout)
  }, [delay])

  return ref
}
