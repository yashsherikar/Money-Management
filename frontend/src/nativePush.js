import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

export async function isNativePushEnabled() {
  if (!isNativePlatform()) return false
  const status = await PushNotifications.checkPermissions()
  return status.receive === 'granted'
}

/** Call after signup/login on native: asks for push permission if not already decided, silently. */
export async function promptNativePushIfNeeded(client) {
  if (!isNativePlatform()) return
  const status = await PushNotifications.checkPermissions()
  if (status.receive === 'granted') return
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
        await client.post('/push/register-fcm-token', { token: token.value })
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

/** Call once at app startup (native only) so tapping a notification navigates to the right page. */
export function listenForNativeNotificationTaps(navigate) {
  if (!isNativePlatform()) return
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification?.data?.url
    if (url) navigate(url)
  })
}

/** Call once at app startup (native only). Android only auto-shows a push in the
 *  tray when the app is backgrounded/killed — while it's open, we have to display
 *  it ourselves or the user never sees it. */
export function listenForNativeForegroundPush() {
  if (!isNativePlatform()) return
  PushNotifications.addListener('pushNotificationReceived', async (notification) => {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now() % 2147483647,
          title: notification.title || 'Money Manager',
          body: notification.body || '',
          smallIcon: 'ic_stat_notify',
          iconColor: '#226DFF',
          extra: notification.data,
        }],
      })
    } catch {
      // no-op — worst case the user just doesn't see this one
    }
  })
}
