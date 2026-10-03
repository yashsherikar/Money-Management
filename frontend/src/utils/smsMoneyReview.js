/**
 * Bank SMS that we saw but could not auto-save → ask user on app open.
 * Also: "you forgot to add" notifications + Mark scam → block sender.
 */
import { Capacitor } from '@capacitor/core'
import { addLocalAppNotification } from './localAppNotifications.js'
import { blockSmsSender } from './smsScamFilter.js'
import { detectMerchantBrand } from './subscriptionBrands.jsx'

const KEY = 'mm_sms_money_review'
const MAX = 25
const NOTIF_ID_BASE = 76000

function uid() {
  return `smr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function notifIdForReview(id) {
  let h = 0
  const s = String(id || '')
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return NOTIF_ID_BASE + (Math.abs(h) % 20000)
}

export function listSmsMoneyReviews() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list.filter((x) => x && x.status === 'pending') : []
  } catch {
    return []
  }
}

function loadAll() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  try {
    window.dispatchEvent(new CustomEvent('mm-sms-money-review-changed', { detail: { list } }))
  } catch { /* ignore */ }
}

/** Stronger duplicate key: amount + direction + normalized body (date omitted — rescan differs). */
export function smsDedupeKey({ amount, direction, body = '', address = '' } = {}) {
  const norm = String(body || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\d{1,2}[:/-]\d{1,2}([:/-]\d{2,4})?/g, '') // times/dates
    .replace(/ref(?:erence)?[:\s#]*[a-z0-9/-]+/gi, 'ref')
    .replace(/upi[:\s/-]*[a-z0-9]+/gi, 'upi')
    .trim()
    .slice(0, 90)
  const addr = String(address || '').toLowerCase().slice(0, 24)
  return `${Number(amount).toFixed(2)}|${direction || ''}|${addr}|${norm}`
}

export function hasSmsMoneyReview(dedupeKey) {
  return loadAll().some((x) => x.dedupeKey === dedupeKey && x.status !== 'dismissed' && x.status !== 'scam')
}

async function notifyForgotExpense(item) {
  if (!item || item.direction === 'CREDIT') return
  const amt = Number(item.amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const brand = detectMerchantBrand(item.merchant, item.raw, item.info)
  const who = brand?.name || item.merchant || 'this payment'
  const title = 'You forgot to add an expense'
  const body = `₹${amt} · ${who} — open app, add category & description`

  addLocalAppNotification({
    title,
    body,
    url: '/transactions',
    kind: 'sms_money_review',
    relatedId: item.id,
  })

  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    try {
      await LocalNotifications.createChannel?.({
        id: 'sms_money_review',
        name: 'Forgot expenses',
        importance: 4,
        description: 'Reminders when a bank SMS expense still needs category & description',
      })
    } catch { /* ignore */ }
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') await LocalNotifications.requestPermissions()
    const again = await LocalNotifications.checkPermissions()
    if (again.display !== 'granted') return
    const id = notifIdForReview(item.id)
    try { await LocalNotifications.cancel({ notifications: [{ id }] }) } catch { /* ignore */ }
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title,
        body,
        schedule: { at: new Date(Date.now() + 1500) },
        extra: { url: '/transactions', reviewId: item.id },
        channelId: 'sms_money_review',
      }],
    })
  } catch { /* ignore */ }
}

/**
 * Queue a bank SMS for user confirmation (credit/debit + category/account).
 */
export function enqueueSmsMoneyReview({
  dedupeKey,
  amount,
  direction,
  kind,
  merchant,
  info,
  bankLabel,
  accountLast4,
  raw,
  address,
  suggestedAccountId = null,
  suggestedCategoryId = null,
  reason = 'needs_confirm',
  date = Date.now(),
}) {
  if (!dedupeKey || !amount) return null
  const all = loadAll()
  if (all.some((x) => x.dedupeKey === dedupeKey && (x.status === 'pending' || x.status === 'saved' || x.status === 'scam'))) {
    return null
  }
  const brand = detectMerchantBrand(merchant, raw, info)
  const item = {
    id: uid(),
    dedupeKey,
    status: 'pending',
    amount: Number(Number(amount).toFixed(2)),
    direction: direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    kind: kind || 'payment',
    merchant: merchant || brand?.name || '',
    info: info || '',
    bankLabel: bankLabel || '',
    accountLast4: accountLast4 || '',
    raw: String(raw || '').slice(0, 400),
    address: address || '',
    suggestedAccountId,
    suggestedCategoryId,
    suggestedDescription: brand ? brand.name : (merchant || ''),
    reason,
    date: Number(date) || Date.now(),
    createdAt: Date.now(),
  }
  all.unshift(item)
  saveAll(all)
  // Fire-and-forget notification
  void notifyForgotExpense(item)
  return item
}

export function updateSmsMoneyReview(id, patch) {
  const all = loadAll()
  const i = all.findIndex((x) => x.id === id)
  if (i < 0) return null
  all[i] = { ...all[i], ...patch, updatedAt: Date.now() }
  saveAll(all)
  return all[i]
}

export function dismissSmsMoneyReview(id) {
  return updateSmsMoneyReview(id, { status: 'dismissed' })
}

export function markSmsMoneyReviewSaved(id, transactionId) {
  return updateSmsMoneyReview(id, { status: 'saved', transactionId: transactionId || null })
}

/**
 * User says this SMS was scam/spam — never populate from this sender again.
 */
export function markSmsMoneyReviewScam(id) {
  const all = loadAll()
  const item = all.find((x) => x.id === id)
  if (!item) return null
  if (item.address) {
    blockSmsSender(item.address, {
      reason: 'user_marked',
      raw: item.raw,
      amount: item.amount,
    })
  }
  return updateSmsMoneyReview(id, { status: 'scam' })
}

const SESSION_SNOOZE_KEY = 'mm_sms_review_session_snooze'

function loadSessionSnooze() {
  try {
    const list = JSON.parse(sessionStorage.getItem(SESSION_SNOOZE_KEY) || '[]')
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

function saveSessionSnooze(set) {
  try {
    sessionStorage.setItem(SESSION_SNOOZE_KEY, JSON.stringify([...set]))
  } catch { /* ignore */ }
}

/** Hide for this app session only — still pending, re-asks on next open. */
export function askLaterSmsMoneyReview(id) {
  const updated = updateSmsMoneyReview(id, { askLaterAt: Date.now() })
  const snoozed = loadSessionSnooze()
  snoozed.add(id)
  saveSessionSnooze(snoozed)
  try {
    window.dispatchEvent(new CustomEvent('mm-sms-money-review-changed'))
  } catch { /* ignore */ }
  return updated
}

export function isSmsMoneyReviewSnoozedThisSession(id) {
  return loadSessionSnooze().has(id)
}

/** Pending items not snoozed in this session (Ask me later). */
export function listActiveSmsMoneyReviews() {
  const snoozed = loadSessionSnooze()
  return listSmsMoneyReviews().filter((x) => !snoozed.has(x.id))
}

export function peekNextSmsMoneyReview() {
  return listActiveSmsMoneyReviews()[0] || null
}

export function countPendingSmsMoneyReviews() {
  return listSmsMoneyReviews().length
}
