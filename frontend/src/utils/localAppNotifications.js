/** Device-only in-app notifications (bell + Notifications page). */

const KEY = 'mm_local_app_notifications'
const MAX = 50

export function listLocalAppNotifications() {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  try {
    window.dispatchEvent(new CustomEvent('mm-local-notifications-changed'))
  } catch { /* ignore */ }
}

export function countUnreadLocalNotifications() {
  return listLocalAppNotifications().filter((n) => !n.viewed).length
}

export function addLocalAppNotification({ title, body, url = '/pending-pays', kind = 'pending_pay', relatedId = null }) {
  const list = listLocalAppNotifications().filter(
    (n) => !(kind === 'pending_pay' && relatedId && n.relatedId === relatedId && n.kind === kind && !n.viewed),
  )
  const item = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: String(title || ''),
    body: String(body || ''),
    url,
    kind,
    relatedId,
    viewed: false,
    createdAt: new Date().toISOString(),
    local: true,
  }
  list.unshift(item)
  save(list)
  return item
}

export function markLocalAppNotificationViewed(id) {
  const list = listLocalAppNotifications().map((n) => (n.id === id ? { ...n, viewed: true } : n))
  save(list)
}

export function removeLocalAppNotificationsForPending(pendingId) {
  const list = listLocalAppNotifications().filter(
    (n) => !(n.kind === 'pending_pay' && n.relatedId === pendingId),
  )
  save(list)
}

export function clearViewedLocalNotifications() {
  save(listLocalAppNotifications().filter((n) => !n.viewed))
}
