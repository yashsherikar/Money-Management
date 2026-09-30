import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '../context/AuthContext.jsx'
import { isNativePlatform, isBiometricEnabled, authenticateWithBiometric } from '../biometricLock.js'
import { isPinSet, verifyAppLockPin } from '../appLock.js'
import PinPad from './PinPad.jsx'
import { LockIconStage, UnlockFlash } from './LockAnimations.jsx'

const MAX_BIOMETRIC_FAILS = 3
const JUST_ONBOARDED_WINDOW_MS = 5000
const SUCCESS_HOLD_MS = 550
const BURST_HOLD_MS = 500

export default function BiometricGate({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [locked, setLocked] = useState(false)
  const [mode, setMode] = useState('biometric')
  const [phase, setPhase] = useState('idle')
  const [flash, setFlash] = useState(false)
  const [pinError, setPinError] = useState(false)
  const [pinAttempt, setPinAttempt] = useState(0)

  const onOnboarding = location.pathname === '/onboarding'
  const needsGate = isNativePlatform() && isPinSet() && !!user && !onOnboarding
  const needsOnboarding = isNativePlatform() && !!user && !isPinSet() && !onOnboarding
  const bioEnabled = isBiometricEnabled()

  const inFlightRef = useRef(false)
  const lastUnlockedAtRef = useRef(0)
  const failCountRef = useRef(0)

  const celebrate = useCallback((onDone) => {
    setPhase('success')
    setFlash(true)
    setTimeout(() => setFlash(false), 700)
    setTimeout(() => {
      setPhase('burst')
      setTimeout(onDone, BURST_HOLD_MS)
    }, SUCCESS_HOLD_MS)
  }, [])

  const tryBiometric = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setPhase('scanning')
    try {
      await authenticateWithBiometric()
      lastUnlockedAtRef.current = Date.now()
      failCountRef.current = 0
      celebrate(() => { setLocked(false); setPhase('idle') })
    } catch {
      failCountRef.current += 1
      if (failCountRef.current >= MAX_BIOMETRIC_FAILS) setMode('pin')
      setPhase('idle')
    } finally {
      inFlightRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate])

  const startLock = useCallback(() => {
    failCountRef.current = 0
    setPhase('idle')
    setLocked(true)
    // Don't auto-launch the native biometric prompt here: it can't be dismissed
    // from JS, so if the user taps "Use PIN instead" while it's still open, the
    // dialog just lingers on top even though we've switched to PIN underneath.
    // Show the icon idle instead — tapping it is what opens the prompt.
    setMode(bioEnabled ? 'biometric' : 'pin')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioEnabled])

  useEffect(() => {
    if (needsOnboarding) navigate('/onboarding', { replace: true })
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
      celebrate(() => { setLocked(false); setPhase('idle') })
    } else {
      setPinError(true)
    }
  }

  if (!needsGate || !locked) return children

  const celebrating = phase === 'success' || phase === 'burst'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-lock-gradient px-4 text-center gap-8 animate-page-in">
      <UnlockFlash visible={flash} />
      <LockIconStage
        variant={mode === 'biometric' ? 'fingerprint' : 'pin'}
        phase={phase}
        onClick={mode === 'biometric' && phase === 'idle' ? tryBiometric : undefined}
      />
      <div>
        <h2 className="text-lg font-bold">
          {celebrating ? 'Unlocked!' : mode === 'biometric' ? (phase === 'scanning' ? 'Verifying…' : 'Unlock with biometrics') : 'Enter your PIN'}
        </h2>
        <p className="text-sm text-muted mt-1">
          {celebrating ? 'Welcome back.' : mode === 'biometric' ? 'Tap the icon or use your fingerprint sensor.' : 'Unlock Money Manager to continue'}
        </p>
      </div>

      {!celebrating && mode === 'pin' && (
        <PinPad
          key={pinAttempt}
          error={pinError}
          onErrorShown={() => { setPinError(false); setPinAttempt((n) => n + 1) }}
          onComplete={handlePinComplete}
        />
      )}

      {!celebrating && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {mode === 'biometric' && (
            <button onClick={tryBiometric} disabled={phase === 'scanning'} className="bg-brand-500 text-white rounded-full px-6 py-3 font-bold disabled:opacity-60">
              {phase === 'scanning' ? 'Verifying…' : 'Unlock'}
            </button>
          )}
          {bioEnabled && (
            <button onClick={() => setMode(mode === 'biometric' ? 'pin' : 'biometric')} className="text-sm text-muted underline">
              {mode === 'biometric' ? 'Use PIN instead' : 'Use biometric instead'}
            </button>
          )}
          <button onClick={logout} className="text-sm text-muted underline">Log out instead</button>
        </div>
      )}
    </div>
  )
}
