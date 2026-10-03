/**
 * One-time native notification setup: permissions, Android channels, tap routing.
 * Call on app start (logged-in) so alerts actually show.
 */
import { Capacitor } from '@capacitor/core'
import client from '../api/client.js'
import { promptNativePushIfNeeded } from '../nativePush.js'

let bootstrapped = false

const CHANNELS = [
  {
    id: 'money_manager_default',
    name: 'Money Manager',
    description: 'Payment requests, dues, and alerts',
    importance: 5,
  },
  {
    id: 'pending_pays',
    name: 'Pending pays',
    description: 'Reminders when bank SMS for a UPI pay is still missing',
    importance: 4,
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    description: 'Subscription due reminders',
    importance: 4,
  },
  {
    id: 'sms_money_review',
    name: 'Forgot expenses',
    description: 'Bank SMS expenses that need category & description',
    importance: 4,
  },
]

async function getLN() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const mod = await import('@capacitor/local-notifications')
    return mod.LocalNotifications
  } catch {
    return null
  }
}

let lastPushRegisterAt = 0
const PUSH_REREGISTER_MS = 6 * 60 * 60_000

/** Request local + push permission and create channels. Safe to call often. */
export async function ensureNotificationPermissions({ refreshPush = false } = {}) {
  if (!Capacitor.isNativePlatform()) return { local: false, push: false }

  let localOk = false
  const LN = await getLN()
  if (LN) {
    try {
      let perm = await LN.checkPermissions()
      if (perm.display !== 'granted') {
        perm = await LN.requestPermissions()
      }
      localOk = perm.display === 'granted'
      if (localOk) {
        for (const ch of CHANNELS) {
          try {
            await LN.createChannel({
              id: ch.id,
              name: ch.name,
              description: ch.description,
              importance: ch.importance,
              visibility: 1,
              vibration: true,
            })
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  const needPush =
    refreshPush ||
    !localStorage.getItem('fcmToken') ||
    Date.now() - lastPushRegisterAt > PUSH_REREGISTER_MS
  if (needPush) {
    try {
      await promptNativePushIfNeeded(client)
      lastPushRegisterAt = Date.now()
    } catch { /* ignore */ }
  }

  return { local: localOk, push: true }
}

/** Wire local-notification taps once (navigate via mm-notification-tap). */
export async function wireLocalNotificationTaps() {
  if (!Capacitor.isNativePlatform()) return
  const LN = await getLN()
  if (!LN) return
  try {
    await LN.removeAllListeners()
  } catch { /* ignore */ }
  LN.addListener('localNotificationActionPerformed', (event) => {
    const extra = event?.notification?.extra || {}
    const url = extra.url || '/notifications'
    try {
      window.dispatchEvent(new CustomEvent('mm-notification-tap', {
        detail: {
          url,
          relatedType: extra.relatedType || null,
          relatedId: extra.relatedId || extra.recurringId || null,
          paid: !!extra.paid,
        },
      }))
    } catch { /* ignore */ }
  })
}

/**
 * Full bootstrap after login / app open with session.
 * refreshPush=true forces FCM token re-post (login / Settings).
 */
export async function bootstrapNotifications({ refreshPush = false } = {}) {
  if (!Capacitor.isNativePlatform()) return
  if (!localStorage.getItem('token')) return
  await ensureNotificationPermissions({ refreshPush: refreshPush || !bootstrapped })
  if (!bootstrapped) {
    await wireLocalNotificationTaps()
    bootstrapped = true
  }
}
