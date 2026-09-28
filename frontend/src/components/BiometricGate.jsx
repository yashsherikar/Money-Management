import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '../context/AuthContext.jsx'
import { isNativePlatform, isBiometricEnabled, authenticateWithBiometric } from '../biometricLock.js'
import { isPinSet, verifyAppLockPin } from '../appLock.js'
import PinPad from './PinPad.jsx'

const MAX_BIOMETRIC_FAILS = 3
const JUST_ONBOARDED_WINDOW_MS = 5000

export default function BiometricGate({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [locked, setLocked] = useState(false)
  const [mode, setMode] = useState('biometric')
  const [checking, setChecking] = useState(false)
  const [pinError, setPinError] = useState(false)
  const [pinAttempt, setPinAttempt] = useState(0)

  const onOnboarding = location.pathname === '/onboarding'
  const needsGate = isNativePlatform() && isPinSet() && !!user && !onOnboarding
  const needsOnboarding = isNativePlatform() && !!user && !isPinSet() && !onOnboarding
  const bioEnabled = isBiometricEnabled()

  const inFlightRef = useRef(false)
  const lastUnlockedAtRef = useRef(0)
  const failCountRef = useRef(0)

  const tryBiometric = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setChecking(true)
    try {
      await authenticateWithBiometric()
      lastUnlockedAtRef.current = Date.now()
      failCountRef.current = 0
      setLocked(false)
    } catch {
      failCountRef.current += 1
      if (failCountRef.current >= MAX_BIOMETRIC_FAILS) {
        setMode('pin')
      }
      setLocked(true)
    } finally {
      setChecking(false)
      inFlightRef.current = false
    }
  }, [])

  const startLock = useCallback(() => {
    failCountRef.current = 0
    setLocked(true)
    if (bioEnabled) {
      setMode('biometric')
      tryBiometric()
    } else {
      setMode('pin')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioEnabled])

  useEffect(() => {
    if (needsOnboarding) {
      navigate('/onboarding', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOnboarding])

  useEffect(() => {
    if (!needsGate) return
    const justOnboarded = Date.now() - Number(localStorage.getItem('justOnboardedAt') || 0) < JUST_ONBOARDED_WINDOW_MS
    if (justOnboarded) {
      setLocked(false)
      return
    }
    startLock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGate])

  useEffect(() => {
    if (!isNativePlatform()) return undefined
    let handle
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || !needsGate) return
      if (Date.now() - lastUnlockedAtRef.current < 2000) return
      startLock()
    }).then((h) => { handle = h })
    return () => handle?.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGate])

  async function handlePinComplete(pin) {
    const ok = await verifyAppLockPin(pin)
    if (ok) {
      failCountRef.current = 0
      lastUnlockedAtRef.current = Date.now()
      setLocked(false)
    } else {
      setPinError(true)
    }
  }

  if (!needsGate || !locked) return children

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-navy px-4 text-center gap-6 animate-page-in">
      {mode === 'pin' ? (
        <>
          <PinPad
            key={pinAttempt}
            title="Enter your PIN"
            subtitle="Unlock Money Manager"
            error={pinError}
            onErrorShown={() => {
              setPinError(false)
              setPinAttempt((n) => n + 1)
            }}
            onComplete={handlePinComplete}
          />
          {bioEnabled && (
            <button onClick={() => { setMode('biometric'); tryBiometric() }} className="text-sm text-muted underline">
              Try biometric instead
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-muted">Unlock Money Manager to continue</p>
          <button
            onClick={tryBiometric}
            disabled={checking}
            className="bg-brand-500 text-white rounded-full px-6 py-3 font-bold disabled:opacity-60"
          >
            {checking ? 'Checking...' : 'Unlock'}
          </button>
          <button onClick={() => setMode('pin')} className="text-sm text-muted underline">Use PIN instead</button>
        </>
      )}
      <button onClick={logout} className="text-sm text-muted underline">Log out instead</button>
    </div>
  )
}
