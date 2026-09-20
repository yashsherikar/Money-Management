function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function isPushEnabled() {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return false
  const subscription = await registration.pushManager.getSubscription()
  return !!subscription
}

export async function enablePush(client) {
  if (!isPushSupported()) {
    throw new Error("Push notifications aren't supported in this browser")
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted')
  }

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const { data } = await client.get('/push/vapid-public-key')
  if (!data.publicKey) {
    throw new Error('Push notifications are not configured on the server yet')
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  })
  const raw = subscription.toJSON()
  await client.post('/push/subscribe', {
    endpoint: raw.endpoint,
    p256dh: raw.keys.p256dh,
    auth: raw.keys.auth,
  })
}

export async function disablePush(client) {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await client.post('/push/unsubscribe', { endpoint: subscription.endpoint })
    await subscription.unsubscribe()
  }
}
