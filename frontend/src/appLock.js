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
}

export async function verifyAppLockPin(pin) {
  const stored = localStorage.getItem('appLockPinHash')
  if (!stored) return false
  return (await sha256Hex(pin)) === stored
}

export function clearAppLockPin() {
  localStorage.removeItem('appLockPinHash')
}
