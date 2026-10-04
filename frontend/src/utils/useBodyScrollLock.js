import { useEffect } from 'react'

/**
 * Lock page scroll while a modal/sheet is open so the background
 * doesn't scroll under the popup on mobile.
 */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}
