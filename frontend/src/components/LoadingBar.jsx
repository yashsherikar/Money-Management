import { useEffect, useState, useSyncExternalStore } from 'react'
import { subscribeLoading, getLoadingSnapshot } from '../api/client.js'

/** Top progress bar — only after a request has been pending >5s (warm APIs stay silent). */
const SHOW_AFTER_MS = 5000

export default function LoadingBar() {
  const loading = useSyncExternalStore(subscribeLoading, getLoadingSnapshot)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!loading) {
      setVisible(false)
      return undefined
    }
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [loading])

  if (!visible) return null
  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 bg-brand-100 z-50 overflow-hidden">
      <div className="h-full w-1/3 bg-brand-500 animate-[loading-bar_1s_ease-in-out_infinite]" />
    </div>
  )
}
