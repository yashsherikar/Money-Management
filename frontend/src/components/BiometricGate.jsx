import { useCallback, useEffect, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '../context/AuthContext.jsx'
import { isNativePlatform, isBiometricEnabled, authenticateWithBiometric } from '../biometricLock.js'

/** Native-only lock screen: requires a fingerprint/face check to view the app
 *  once logged in, and again whenever the app returns from the background. */
export default function BiometricGate({ children }) {
  const { user, logout } = useAuth()
  const [locked, setLocked] = useState(false)
  const [checking, setChecking] = useState(false)

  const needsGate = isNativePlatform() && isBiometricEnabled() && !!user

  const tryUnlock = useCallback(async () => {
    setChecking(true)
    try {
      await authenticateWithBiometric()
      setLocked(false)
    } catch {
      setLocked(true)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (needsGate) {
      setLocked(true)
      tryUnlock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGate])

  useEffect(() => {
    if (!isNativePlatform()) return undefined
    let handle
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && needsGate) tryUnlock()
    }).then((h) => { handle = h })
    return () => handle?.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGate])

  if (!needsGate || !locked) return children

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-navy px-4 text-center gap-4">
      <p className="text-muted">Unlock Money Manager to continue</p>
      <button
        onClick={tryUnlock}
        disabled={checking}
        className="bg-brand-500 text-white rounded-full px-6 py-3 font-bold disabled:opacity-60"
      >
        {checking ? 'Checking...' : 'Unlock'}
      </button>
      <button onClick={logout} className="text-sm text-muted underline">Log out instead</button>
    </div>
  )
}
