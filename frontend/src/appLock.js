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

/** How long the app can be backgrounded (QR scanner, UPI app, brief switch)
 *  before returning requires biometric/PIN again. */
export const RESUME_LOCK_AFTER_MS = 15_000

let suppressResumeLockUntil = 0

/** Call before opening a native overlay (QR scanner, UPI pay) so returning
 *  doesn't treat that as "left the app" and demand biometric. */
export function suppressResumeLock(ms = 120_000) {
  suppressResumeLockUntil = Math.max(suppressResumeLockUntil, Date.now() + ms)
}

export function isResumeLockSuppressed() {
  return Date.now() < suppressResumeLockUntil
}

