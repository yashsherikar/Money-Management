/** Local store for P2P / merchant pays waiting for bank SMS confirmation (per user). */

import { currentUserId, isLoggedIn, userGetItem, userSetItem } from './userStorage.js'

const KEY = 'mm_pending_p2p_pays'
const MAX_ITEMS = 40
/** Keep waiting up to 24h — bank SMS can be 5–15+ min late. */
export const P2P_PENDING_TTL_MS = 24 * 60 * 60_000
export const P2P_REMIND_AFTER_MS = 15 * 60_000

function uid() {
  return `p2p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function listPendingP2pPays() {
  if (!isLoggedIn()) return []
  const uidNow = currentUserId()
  try {
    const raw = userGetItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    const now = Date.now()
    let changed = false
    const next = list.map((item) => {
      if (!item || !item.id) return null
      // Skip other users' leftovers (legacy)
      if (item.userId && String(item.userId) !== uidNow) return null
      if ((item.status === 'waiting_sms' || item.status === 'pending')
          && item.expiresAt && now > item.expiresAt) {
        changed = true
        return { ...item, status: 'expired', updatedAt: now, userId: item.userId || uidNow }
      }
      return item.userId ? item : { ...item, userId: uidNow }
    }).filter(Boolean)
    if (changed) saveAll(next)
    return next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  } catch {
    return []
  }
}

function saveAll(list) {
  if (!isLoggedIn()) return
  const trimmed = list.slice(0, MAX_ITEMS)
  userSetItem(KEY, JSON.stringify(trimmed))
  try {
    window.dispatchEvent(new CustomEvent('mm-pending-p2p-changed', { detail: { list: trimmed } }))
  } catch { /* ignore */ }
}

/**
 * Create a waiting-SMS pending after user opens UPI.
 * Optional kind/requestId → auto confirm-sent when SMS matches name+amount+time.
 */
export function addPendingP2pPay({
  pa,
  pn,
  amount,
  personal = true,
  kind = null,
  requestId = null,
  participantId = null,
  notificationId = null,
  categoryId = null,
  description = null,
} = {}) {
  if (!isLoggedIn()) return null
  const now = Date.now()
  const item = {
    id: uid(),
    userId: currentUserId(),
    pa: String(pa || '').toLowerCase().trim(),
    pn: String(pn || '').trim(),
    amount: Number(Number(amount).toFixed(2)),
    personal: !!personal,
    kind: kind || null,
    requestId: requestId || null,
    participantId: participantId || null,
    notificationId: notificationId || null,
    categoryId: categoryId != null ? String(categoryId) : null,
    description: description ? String(description).trim().slice(0, 220) : null,
    status: 'waiting_sms',
    createdAt: now,
    updatedAt: now,
    expiresAt: now + P2P_PENDING_TTL_MS,
    remindAt: now + P2P_REMIND_AFTER_MS,
    reminded: false,
    confirmedAt: null,
    smsRaw: null,
    source: null,
    transactionLogged: false,
    transactionId: null,
  }
  const list = listPendingP2pPays().filter((x) => x.status !== 'expired' || now - (x.updatedAt || 0) < 7 * 24 * 60 * 60_000)
  list.unshift(item)
  saveAll(list)

  import('./pendingPayReminders.js')
    .then((m) => m.schedulePendingPayReminder(item))
    .catch(() => {})

  return item
}

export function getPendingP2pPay(id) {
  return listPendingP2pPays().find((x) => x.id === id) || null
}

export function updatePendingP2pPay(id, patch) {
  const list = listPendingP2pPays()
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) return null
  list[i] = { ...list[i], ...patch, updatedAt: Date.now() }
  saveAll(list)
  return list[i]
}

export function markPendingP2pConfirmed(id, { smsRaw, source, transactionId, transactionLogged } = {}) {
  const updated = updatePendingP2pPay(id, {
    status: 'confirmed',
    confirmedAt: Date.now(),
    smsRaw: smsRaw || null,
    source: source || 'sms',
    transactionId: transactionId ?? null,
    transactionLogged: transactionLogged === true,
  })
  import('./pendingPayReminders.js')
    .then((m) => m.cancelPendingPayReminder(id))
    .catch(() => {})
  return updated
}

export function markPendingP2pNotPaid(id) {
  const updated = updatePendingP2pPay(id, { status: 'not_paid' })
  import('./pendingPayReminders.js')
    .then((m) => m.cancelPendingPayReminder(id))
    .catch(() => {})
  return updated
}

/** Bank SMS says UPI/payment failed — stop waiting for debit confirmation. */
export function markPendingP2pFailed(id, { smsRaw, reason = 'payment_failed' } = {}) {
  const updated = updatePendingP2pPay(id, {
    status: 'failed',
    failedAt: Date.now(),
    failReason: reason,
    smsRaw: smsRaw || null,
    source: 'sms_failed',
  })
  import('./pendingPayReminders.js')
    .then((m) => m.cancelPendingPayReminder(id))
    .catch(() => {})
  return updated
}

export function removePendingP2pPay(id) {
  const list = listPendingP2pPays().filter((x) => x.id !== id)
  saveAll(list)
  import('./pendingPayReminders.js')
    .then((m) => m.cancelPendingPayReminder(id))
    .catch(() => {})
}

export function waitingP2pPays() {
  return listPendingP2pPays().filter((x) => x.status === 'waiting_sms' || x.status === 'pending')
}

export function countWaitingP2pPays() {
  return waitingP2pPays().length
}
