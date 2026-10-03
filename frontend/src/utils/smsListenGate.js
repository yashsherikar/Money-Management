/**
 * SMS money features only process messages from "now" forward.
 * Never pull old inbox history into Transactions / forgot-expense / autopay.
 * Native side mirrors listen-from so killed-app live queue ignores older SMS.
 */

import { Capacitor, registerPlugin } from '@capacitor/core'

const LISTEN_FROM_KEY = 'mm_sms_listen_from'
const SmsReader = registerPlugin('SmsReader')

function syncNativeListenFrom(ms) {
  if (!Capacitor.isNativePlatform() || !ms) return
  SmsReader.setListenFrom({ sinceMs: ms }).catch(() => {})
}

/** First time SMS is enabled → freeze "start listening" at this moment. */
export function ensureSmsListenFrom() {
  try {
    const existing = Number(localStorage.getItem(LISTEN_FROM_KEY) || 0)
    if (existing > 0) {
      syncNativeListenFrom(existing)
      return existing
    }
    const now = Date.now()
    localStorage.setItem(LISTEN_FROM_KEY, String(now))
    syncNativeListenFrom(now)
    return now
  } catch {
    return Date.now()
  }
}

/** Call when user newly grants SMS permission — ignore everything before this. */
export function markSmsListenFromNow() {
  const now = Date.now()
  try {
    localStorage.setItem(LISTEN_FROM_KEY, String(now))
  } catch { /* ignore */ }
  syncNativeListenFrom(now)
  return now
}

export function getSmsListenFrom() {
  return ensureSmsListenFrom()
}

/** True if this SMS timestamp is at/after our listen window (with 30s skew). */
export function isSmsFromPresent(msgOrDate) {
  const listenFrom = getSmsListenFrom()
  const date = typeof msgOrDate === 'number'
    ? msgOrDate
    : Number(msgOrDate?.date || msgOrDate?.timestamp || Date.now())
  if (!Number.isFinite(date) || date <= 0) {
    // Live RECEIVE_SMS often has "now" — allow
    return true
  }
  return date >= listenFrom - 30_000
}
