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
export async function promptNativePushIfNeeded(client) {
  if (!isNativePlatform()) return
  const status = await PushNotifications.checkPermissions()
  if (status.receive === 'denied') return
  try {
    await enableNativePush(client)
  } catch {
    // user declined or registration failed — they can retry from Settings
  }
}

/** Registers this device for FCM push and sends the resulting token to the backend. */
export function enableNativePush(client) {
  return new Promise((resolve, reject) => {
    let settled = false

    PushNotifications.addListener('registration', async (token) => {
      try {
        await client.post('/push/register-fcm-token', { token: token.value, deviceId: getDeviceId() })
        localStorage.setItem('fcmToken', token.value)
        settled = true
        resolve()
      } catch (err) {
        settled = true
        reject(err)
      }
    })

    PushNotifications.addListener('registrationError', (err) => {
      settled = true
      reject(new Error(err.error || 'Push registration failed'))
    })

    PushNotifications.checkPermissions()
      .then((status) => (status.receive === 'prompt' ? PushNotifications.requestPermissions() : status))
      .then((status) => {
        if (status.receive !== 'granted') {
          throw new Error('Notification permission was not granted')
        }
        return PushNotifications.register()
      })
      .catch((err) => {
        if (!settled) reject(err)
      })
  })
}

export async function disableNativePush(client) {
  const token = localStorage.getItem('fcmToken')
  if (token) {
    await client.post('/push/unregister-fcm-token', { token })
    localStorage.removeItem('fcmToken')
  }
  await PushNotifications.removeAllListeners()
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
  if (!isNativePlatform()) return
  window.addEventListener('mm-notification-tap', async (e) => {
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
  })
}
