/** Local, offline app-unlock PIN (separate from the server-verified "secret PIN"
 *  used to reveal your total balance) — hashed and kept device-side only, so
 *  unlocking never depends on a network round trip (important since the
 *  backend can be asleep/cold-starting on Render's free tier). */

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function isPinSet() {
  return !!localStorage.getItem('appLockPinHash')
}

export async function setAppLockPin(pin) {
  localStorage.setItem('appLockPinHash', await sha256Hex(pin))
  resetPinAttempts()
}

export function clearAppLockPin() {
  localStorage.removeItem('appLockPinHash')
  resetPinAttempts()
}

// Rate limiting: 5 wrong PINs locks entry out for an escalating cooldown (30s, 1m, 5m,
// 15m, then stays at 15m), persisted in localStorage so killing/reopening the app
// doesn't reset it. Resets fully on a correct PIN or a new PIN being set.
const MAX_ATTEMPTS = 5
const LOCKOUT_STAGES_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000]

function readNum(key) {
  return Number(localStorage.getItem(key) || 0)
}

function resetPinAttempts() {
  localStorage.removeItem('appLockFailCount')
  localStorage.removeItem('appLockLockoutStage')
  localStorage.removeItem('appLockLockoutUntil')
}

export function getLockoutRemainingMs() {
  return Math.max(0, readNum('appLockLockoutUntil') - Date.now())
}

export function isLockedOut() {
  return getLockoutRemainingMs() > 0
}

export async function verifyAppLockPin(pin) {
  if (isLockedOut()) return false
  const stored = localStorage.getItem('appLockPinHash')
  if (!stored) return false

  if ((await sha256Hex(pin)) === stored) {
    resetPinAttempts()
    return true
  }

  const fails = readNum('appLockFailCount') + 1
  if (fails >= MAX_ATTEMPTS) {
    const stage = readNum('appLockLockoutStage')
    const duration = LOCKOUT_STAGES_MS[Math.min(stage, LOCKOUT_STAGES_MS.length - 1)]
    localStorage.setItem('appLockLockoutUntil', String(Date.now() + duration))
    localStorage.setItem('appLockLockoutStage', String(stage + 1))
    localStorage.setItem('appLockFailCount', '0')
  } else {
    localStorage.setItem('appLockFailCount', String(fails))
  }
  return false
}

/** How long the app can be backgrounded (brief switch) before biometric/PIN again. */
export const RESUME_LOCK_AFTER_MS = 15_000

const SUPPRESS_KEY = 'mm_suppress_lock_until'

let suppressResumeLockUntil = 0

function readPersistedSuppress() {
  // localStorage survives camera / GPay when Android kills the WebView;
  // sessionStorage alone is wiped on process death → biometric pops again.
  let until = 0
  try {
    until = Math.max(until, Number(localStorage.getItem(SUPPRESS_KEY) || 0))
  } catch { /* ignore */ }
  try {
    until = Math.max(until, Number(sessionStorage.getItem(SUPPRESS_KEY) || 0))
  } catch { /* ignore */ }
  if (until > Date.now()) return until
  try { localStorage.removeItem(SUPPRESS_KEY) } catch { /* ignore */ }
  try { sessionStorage.removeItem(SUPPRESS_KEY) } catch { /* ignore */ }
  return 0
}

/** Call before opening camera / QR / GPay so returning doesn't demand biometric.
 *  Persisted in localStorage — Android may kill the WebView while camera is open. */
export function suppressResumeLock(ms = 300_000) {
  const until = Date.now() + ms
  suppressResumeLockUntil = Math.max(suppressResumeLockUntil, until, readPersistedSuppress())
  const val = String(suppressResumeLockUntil)
  try { localStorage.setItem(SUPPRESS_KEY, val) } catch { /* ignore */ }
  try { sessionStorage.setItem(SUPPRESS_KEY, val) } catch { /* ignore */ }
}

export function isResumeLockSuppressed() {
  const until = Math.max(suppressResumeLockUntil, readPersistedSuppress())
  suppressResumeLockUntil = until
  return Date.now() < until
}

const PENDING_UPI_KEY = 'mm_pending_upi_confirm'
const PENDING_UPI_KEY_LEGACY = 'mm_pending_upi_confirm' // was sessionStorage

/**
 * Save pay context before leaving for GPay/PhonePe.
 * Uses localStorage so "Did you pay?" still shows after both apps are force-closed.
 */
export function savePendingUpiConfirm(payload) {
  try {
    const data = JSON.stringify({ ...payload, savedAt: Date.now() })
    localStorage.setItem(PENDING_UPI_KEY, data)
    try { sessionStorage.removeItem(PENDING_UPI_KEY_LEGACY) } catch { /* ignore */ }
  } catch { /* ignore */ }
}

export function readPendingUpiConfirm() {
  try {
    let raw = localStorage.getItem(PENDING_UPI_KEY)
    if (!raw) {
      // migrate older sessionStorage saves once
      raw = sessionStorage.getItem(PENDING_UPI_KEY_LEGACY)
      if (raw) {
        localStorage.setItem(PENDING_UPI_KEY, raw)
        sessionStorage.removeItem(PENDING_UPI_KEY_LEGACY)
      }
    }
    if (!raw) return null
    const data = JSON.parse(raw)
    // Expire after 24 hours (user may close both apps for a while)
    if (!data?.savedAt || Date.now() - data.savedAt > 24 * 60 * 60_000) {
      localStorage.removeItem(PENDING_UPI_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function clearPendingUpiConfirm() {
  try { localStorage.removeItem(PENDING_UPI_KEY) } catch { /* ignore */ }
  try { sessionStorage.removeItem(PENDING_UPI_KEY_LEGACY) } catch { /* ignore */ }
}

