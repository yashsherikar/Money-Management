import { useEffect } from 'react'

let lockCount = 0
let savedScrollY = 0

function applyLock() {
  savedScrollY = window.scrollY || window.pageYOffset || 0
  const html = document.documentElement
  const body = document.body
  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `-${savedScrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
}

function releaseLock() {
  const html = document.documentElement
  const body = document.body
  html.style.overflow = ''
  body.style.overflow = ''
  body.style.position = ''
  body.style.top = ''
  body.style.left = ''
  body.style.right = ''
  body.style.width = ''
  window.scrollTo(0, savedScrollY)
}

/**
 * Lock page scroll while a modal/sheet is open.
 * Uses position:fixed so mobile WebViews don't keep scrolling under the popup.
 */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined
    if (lockCount === 0) applyLock()
    lockCount += 1
    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) releaseLock()
    }
  }, [locked])
}
