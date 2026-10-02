import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '../context/AuthContext.jsx'
import { isNativePlatform, isBiometricEnabled, authenticateWithBiometric, setBiometricEnabled } from '../biometricLock.js'
import { isPinSet, verifyAppLockPin, getLockoutRemainingMs, clearAppLockPin, RESUME_LOCK_AFTER_MS, isResumeLockSuppressed, readPendingUpiConfirm } from '../appLock.js'
import PinPad from './PinPad.jsx'
import { LockIconStage, UnlockFlash } from './LockAnimations.jsx'

const MAX_BIOMETRIC_FAILS = 3
const JUST_ONBOARDED_WINDOW_MS = 5000
const SUCCESS_HOLD_MS = 550
const BURST_HOLD_MS = 500
// The native biometric prompt closing can itself fire Android's onResume, which looks
// identical to the user switching back from another app. Without this cooldown, that
// resume re-triggers startLock() -> tryBiometric() -> reopens the prompt -> loops forever.
const BIOMETRIC_DISMISS_COOLDOWN_MS = 3000

function formatCountdown(ms) {
  const totalSeconds = Math.ceil(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function BiometricGate({ children }) {
  const { user, logout, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [locked, setLocked] = useState(false)
  const [mode, setMode] = useState('biometric')
  const [phase, setPhase] = useState('idle')
  const [flash, setFlash] = useState(false)
  const [pinError, setPinError] = useState(false)
  const [pinAttempt, setPinAttempt] = useState(0)
  const [lockoutMsLeft, setLockoutMsLeft] = useState(0)
  const [showForgotPin, setShowForgotPin] = useState(false)
  const [forgotPassword, setForgotPassword] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotBusy, setForgotBusy] = useState(false)

  const onOnboarding = location.pathname === '/onboarding'
  const needsGate = isNativePlatform() && isPinSet() && !!user && !onOnboarding
  const needsOnboarding = isNativePlatform() && !!user && !isPinSet() && !onOnboarding
  const bioEnabled = isBiometricEnabled()

  const inFlightRef = useRef(false)
  const lastUnlockedAtRef = useRef(0)
  const lastBiometricAttemptEndedAtRef = useRef(0)
  const backgroundedAtRef = useRef(0)
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
      lastBiometricAttemptEndedAtRef.current = Date.now()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate])

  const startLock = useCallback(() => {
    failCountRef.current = 0
    setPhase('idle')
    setLocked(true)
    setShowForgotPin(false)
    setForgotPassword('')
    setForgotError('')
    if (bioEnabled) {
      setMode('biometric')
      tryBiometric()
    } else {
      setMode('pin')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioEnabled])

  useEffect(() => {
    if (needsOnboarding) navigate('/onboarding', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOnboarding])

  useEffect(() => {
    if (!needsGate) return
    const justOnboarded = Date.now() - Number(localStorage.getItem('justOnboardedAt') || 0) < JUST_ONBOARDED_WINDOW_MS
    // Returning from GPay / scanner: WebView may remount — skip lock if suppressed or pay confirm pending
    if (justOnboarded || isResumeLockSuppressed() || readPendingUpiConfirm()) {
      setLocked(false)
      return
    }
    startLock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGate])

  useEffect(() => {
    if (!locked) return undefined
    const tick = () => setLockoutMsLeft(getLockoutRemainingMs())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [locked])

  useEffect(() => {
    if (!isNativePlatform()) return undefined
    let handle
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!needsGate) return

      if (!isActive) {
        // Going to background (home, QR scanner, GPay, another app…)
        backgroundedAtRef.current = Date.now()
        return
      }

      // Becoming active again — only lock if away long enough, or not suppressed
      // (e.g. QR scanner / UPI pay marked a temporary suppress).
      if (isResumeLockSuppressed()) return
      if (Date.now() - lastBiometricAttemptEndedAtRef.current < BIOMETRIC_DISMISS_COOLDOWN_MS) return

      const awayMs = backgroundedAtRef.current
        ? Date.now() - backgroundedAtRef.current
        : RESUME_LOCK_AFTER_MS + 1
      backgroundedAtRef.current = 0

      if (awayMs < RESUME_LOCK_AFTER_MS) return

      startLock()
    }).then((h) => { handle = h })
    return () => handle?.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGate, startLock])

  async function handlePinComplete(pin) {
    const ok = await verifyAppLockPin(pin)
    if (ok) {
      failCountRef.current = 0
      lastUnlockedAtRef.current = Date.now()
      setLockoutMsLeft(0)
      celebrate(() => { setLocked(false); setPhase('idle') })
    } else {
      setPinError(true)
      setLockoutMsLeft(getLockoutRemainingMs())
    }
  }

  async function handleForgotPin(e) {
    e.preventDefault()
    setForgotBusy(true)
    setForgotError('')
    try {
      await login(user.email, forgotPassword)
      clearAppLockPin()
      setBiometricEnabled(false)
      setLocked(false)
      navigate('/onboarding', { replace: true })
    } catch {
      setForgotError('Incorrect password.')
    } finally {
      setForgotBusy(false)
    }
  }

  if (!needsGate || !locked) return children

  const celebrating = phase === 'success' || phase === 'burst'
  const pinLockedOut = mode === 'pin' && lockoutMsLeft > 0

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
          {celebrating ? 'Unlocked!' : pinLockedOut ? 'Too many attempts' : mode === 'biometric' ? (phase === 'scanning' ? 'Verifying…' : 'Unlock with biometrics') : 'Enter your PIN'}
        </h2>
        <p className="text-sm text-muted mt-1">
          {celebrating
            ? 'Welcome back.'
            : pinLockedOut
            ? `Try again in ${formatCountdown(lockoutMsLeft)}`
            : mode === 'biometric'
            ? 'Tap the icon or use your fingerprint sensor.'
            : 'Unlock Money Manager to continue'}
        </p>
      </div>

      {!celebrating && mode === 'pin' && !pinLockedOut && !showForgotPin && (
        <PinPad
          key={pinAttempt}
          error={pinError}
          onErrorShown={() => { setPinError(false); setPinAttempt((n) => n + 1) }}
          onComplete={handlePinComplete}
        />
      )}

      {!celebrating && showForgotPin && (
        <form onSubmit={handleForgotPin} className="flex flex-col gap-3 w-full max-w-xs text-left">
          <p className="text-sm text-muted text-center">Enter your account password to reset your PIN.</p>
          <input
            type="password"
            autoFocus
            required
            placeholder="Password"
            value={forgotPassword}
            onChange={(e) => setForgotPassword(e.target.value)}
            className="px-3 py-2 rounded-md bg-field text-slate-900"
          />
          {forgotError && <div className="text-sm text-red-500 text-center">{forgotError}</div>}
          <button type="submit" disabled={forgotBusy} className="bg-brand-500 text-white rounded-full px-6 py-3 font-bold disabled:opacity-60">
            {forgotBusy ? 'Verifying…' : 'Verify & reset PIN'}
          </button>
          <button type="button" onClick={() => { setShowForgotPin(false); setForgotError(''); setForgotPassword('') }} className="text-sm text-muted underline">
            Cancel
          </button>
        </form>
      )}

      {!celebrating && !showForgotPin && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {mode === 'biometric' && (
            <button onClick={tryBiometric} disabled={phase === 'scanning'} className="bg-brand-500 text-white rounded-full px-6 py-3 font-bold disabled:opacity-60">
              {phase === 'scanning' ? 'Verifying…' : 'Unlock'}
            </button>
          )}
          {bioEnabled && (
            <button
              onClick={() => setMode(mode === 'biometric' ? 'pin' : 'biometric')}
              disabled={phase === 'scanning'}
              className="text-sm text-muted underline disabled:opacity-40 disabled:no-underline"
            >
              {mode === 'biometric' ? 'Use PIN instead' : 'Use biometric instead'}
            </button>
          )}
          {mode === 'pin' && (
            <button onClick={() => setShowForgotPin(true)} className="text-sm text-muted underline">Forgot PIN?</button>
          )}
          <button onClick={logout} className="text-sm text-muted underline">Log out instead</button>
        </div>
      )}
    </div>
  )
}
