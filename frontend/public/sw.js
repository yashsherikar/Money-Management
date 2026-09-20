self.addEventListener('push', (event) => {
  let data = { title: 'Money Manager', body: 'You have a new notification' }
  try {
    if (event.data) data = event.data.json()
  } catch {
    // ignore malformed payloads, fall back to default
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo-32.png',
      badge: '/logo-32.png',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/requests'))
})
