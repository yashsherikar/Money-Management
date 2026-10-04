/** Device-only in-app notifications (bell + Notifications page) — per logged-in user. */

import { currentUserId, isLoggedIn, userGetItem, userSetItem } from './userStorage.js'

const KEY = 'mm_local_app_notifications'
const MAX = 50

/** Kinds that must not spam a new unread row for the same relatedId on every app sync. */
const DEDUPE_KINDS = new Set([
  'pending_pay',
  'subscription',
  'recurring',
  'due',
  'emergency_fund',
  'emi',
])

export function listLocalAppNotifications() {
  if (!isLoggedIn()) return []
  const uid = currentUserId()
  try {
    const raw = userGetItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.filter((n) => !n.userId || String(n.userId) === uid)
  } catch {
    return []
  }
}

function save(list) {
  if (!isLoggedIn()) return
  userSetItem(KEY, JSON.stringify(list.slice(0, MAX)))
  try {
    window.dispatchEvent(new CustomEvent('mm-local-notifications-changed'))
  } catch { /* ignore */ }
}

export function countUnreadLocalNotifications() {
  return listLocalAppNotifications().filter((n) => !n.viewed).length
}

export function addLocalAppNotification({
  title,
  body,
  url = '/pending-pays',
  kind = 'pending_pay',
  relatedId = null,
  relatedType = null,
} = {}) {
  if (!isLoggedIn()) return null

  // Already have an unread for this related item — don't stack on every focus/sync
  if (relatedId != null && DEDUPE_KINDS.has(kind)) {
    const existing = listLocalAppNotifications().find(
      (n) => n.kind === kind && String(n.relatedId) === String(relatedId) && !n.viewed,
    )
    if (existing) return existing
  }

  const list = listLocalAppNotifications().filter(
    (n) => !(
      relatedId != null
      && DEDUPE_KINDS.has(kind)
      && n.relatedId != null
      && String(n.relatedId) === String(relatedId)
      && n.kind === kind
      && !n.viewed
    ),
  )
  const item = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: currentUserId(),
    title: String(title || ''),
    body: String(body || ''),
    url,
    kind,
    relatedId,
    relatedType,
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

/** Remove due / subscription reminders for a recurring (or any related) id after paid. */
export function removeLocalAppNotificationsForRelated(relatedId, kinds = null) {
  if (relatedId == null) return
  const id = String(relatedId)
  const kindSet = kinds ? new Set(kinds) : null
  const list = listLocalAppNotifications().filter((n) => {
    if (String(n.relatedId) !== id) return true
    if (kindSet && !kindSet.has(n.kind)) return true
    return false
  })
  save(list)
}

export function clearViewedLocalNotifications() {
  save(listLocalAppNotifications().filter((n) => !n.viewed))
}
