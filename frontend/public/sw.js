// Force this version to take over immediately instead of waiting for every open
// tab to close — without this, an old (possibly broken) push handler can keep
// running indefinitely on a phone that never fully closes the app.
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Chrome/Android only treats an "Add to Home Screen" icon as a real installed
// app (WebAPK) — not just a bookmark shortcut — if the service worker has a
// fetch handler. Without this, notifications can render as a generic bookmark
// card instead of the app's own rich notification (this is likely why Chrome
// behaved differently from Firefox, which doesn't gate on this).
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

self.addEventListener('push', (event) => {
  let data = { title: 'Money Manager', body: 'You have a new notification', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    // ignore malformed payloads, fall back to default
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo-192.png',
      badge: '/logo-32.png',
      vibrate: [100, 50, 100],
      data: { url: data.url },
      actions: [{ action: 'view', title: 'View' }],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
