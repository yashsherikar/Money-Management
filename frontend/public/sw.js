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
