import { useSyncExternalStore } from 'react'
import { subscribeLoading, getLoadingSnapshot } from '../api/client.js'

export default function LoadingBar() {
  const loading = useSyncExternalStore(subscribeLoading, getLoadingSnapshot)
  if (!loading) return null
  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 bg-brand-100 z-50 overflow-hidden">
      <div className="h-full w-1/3 bg-brand-500 animate-[loading-bar_1s_ease-in-out_infinite]" />
    </div>
  )
}
