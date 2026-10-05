import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import {
  RELATED,
  confirmDuePaid,
  parseConfirmIdFromUrl,
  notifyTransactionsChanged,
} from './utils/confirmDuePaid.js'

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

/** Stable per-install id, generated once and kept in localStorage — survives logout/login and
 *  FCM token rotation, so the backend can tell "same device, new token" from "a new device". */
function getDeviceId() {
  let id = localStorage.getItem('deviceId')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('deviceId', id)
  }
  return id
}

export async function isNativePushEnabled() {
  if (!isNativePlatform()) return false
  const status = await PushNotifications.checkPermissions()
  return status.receive === 'granted'
}

/** Call after signup/login on native: (re)registers the FCM token every time, not just
 *  the first time. FCM tokens can rotate (reinstalls, cleared app data, periodic Google
 *  rotation) — re-registering on every login is what keeps the backend's copy fresh, and
 *  is a no-op cost-wise since it skips the OS permission dialog once already granted. */
/** @returns {Promise<boolean>} true only if a token was actually registered with the backend. */
export async function promptNativePushIfNeeded(client) {
  if (!isNativePlatform()) return false
  const status = await PushNotifications.checkPermissions()
  if (status.receive === 'denied') return false
  try {
    await enableNativePush(client)
    return true
  } catch {
    // user declined or registration failed — caller decides how to surface this
    return false
  }
}

let registerInFlight = null

/**
 * Registers this device for FCM push and sends the resulting token to the backend.
 * Safe to call repeatedly: clears stale listeners, dedupes concurrent calls, and
 * falls back to the cached token if Capacitor does not re-emit "registration".
 */
export function enableNativePush(client) {
  if (!isNativePlatform()) {
    return Promise.reject(new Error('Not a native platform'))
  }
  if (registerInFlight) return registerInFlight

  registerInFlight = (async () => {
    try {
      try {
        await PushNotifications.removeAllListeners()
      } catch { /* ignore */ }

      let status = await PushNotifications.checkPermissions()
      if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
        status = await PushNotifications.requestPermissions()
      }
      if (status.receive !== 'granted') {
        throw new Error('Notification permission was not granted')
      }

      const tokenValue = await new Promise((resolve, reject) => {
        let done = false
        const finish = (fn) => (value) => {
          if (done) return
          done = true
          clearTimeout(timer)
          fn(value)
        }

        const timer = setTimeout(() => {
          const cached = localStorage.getItem('fcmToken')
          if (cached) finish(resolve)(cached)
          else finish(reject)(new Error('Push registration timed out'))
        }, 12_000)

        PushNotifications.addListener('registration', (token) => {
          finish(resolve)(token?.value)
        })
        PushNotifications.addListener('registrationError', (err) => {
          finish(reject)(new Error(err?.error || 'Push registration failed'))
        })

        PushNotifications.register().catch((err) => {
          finish(reject)(err)
        })
      })

      if (!tokenValue) throw new Error('No FCM token received')

      await client.post('/push/register-fcm-token', {
        token: tokenValue,
        deviceId: getDeviceId(),
      })
      localStorage.setItem('fcmToken', tokenValue)
    } finally {
      registerInFlight = null
    }
  })()

  return registerInFlight
}

export async function disableNativePush(client) {
  const token = localStorage.getItem('fcmToken')
  if (token) {
    await client.post('/push/unregister-fcm-token', { token })
    localStorage.removeItem('fcmToken')
  }
  try {
    await PushNotifications.removeAllListeners()
  } catch { /* ignore */ }
}

async function tryConfirmFromTap(detail) {
  const relatedType = detail?.relatedType
  const relatedId = detail?.relatedId != null ? Number(detail.relatedId) : null
  if (detail?.paid && relatedType && relatedId) {
    await confirmDuePaid(relatedType, relatedId)
    notifyTransactionsChanged()
    return true
  }
  if (detail?.paid && detail?.url) {
    const confirmId = parseConfirmIdFromUrl(detail.url)
    if (confirmId && detail.url.includes('/recurring')) {
      await confirmDuePaid(RELATED.RECURRING, confirmId)
      notifyTransactionsChanged()
      return true
    }
  }
  return false
}

/** Call once at app startup (native only) so tapping a notification navigates or logs paid. */
export function listenForNotificationTaps(navigate) {
  if (!isNativePlatform()) return () => {}
  const onTap = async (e) => {
    const detail = e.detail || {}
    try {
      if (detail.paid) {
        const logged = await tryConfirmFromTap(detail)
        if (logged) {
          navigate('/transactions')
          return
        }
      }
    } catch {
      // fall through to open the linked page
    }
    const url = detail.url?.split('?')[0] || detail.url
    if (url) navigate(url)
  }
  window.addEventListener('mm-notification-tap', onTap)
  return () => window.removeEventListener('mm-notification-tap', onTap)
}
