/**
 * Bank SMS that we saw but could not auto-save → ask user on app open.
 * Also: "you forgot to add" notifications + Mark scam → block sender.
 */
import { Capacitor } from '@capacitor/core'
import { addLocalAppNotification } from './localAppNotifications.js'
import { blockSmsSender } from './smsScamFilter.js'
import { detectMerchantBrand } from './subscriptionBrands.jsx'
import {
  currentUserId,
  isLoggedIn,
  userGetItem,
  userSetItem,
  userSessionGetItem,
  userSessionSetItem,
} from './userStorage.js'

const KEY = 'mm_sms_money_review'
/** Several debit/credit/cashback SMS can land in one burst — keep room for all. */
const MAX = 40
const NOTIF_ID_BASE = 76000

function uid() {
  return `smr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function captureUpiRef(raw) {
  const m = String(raw || '').match(/\bupi\s*[:\-]?\s*([0-9]{6,22})/i)
  return m ? m[1] : ''
}

function notifIdForReview(id) {
  let h = 0
  const s = String(id || '')
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return NOTIF_ID_BASE + (Math.abs(h) % 20000)
}

export function listSmsMoneyReviews() {
  if (!isLoggedIn()) return []
  const uid = currentUserId()
  try {
    const list = JSON.parse(userGetItem(KEY) || '[]')
    return Array.isArray(list)
      ? list.filter((x) => x && x.status === 'pending' && (!x.userId || String(x.userId) === uid))
      : []
  } catch {
    return []
  }
}

function loadAll() {
  if (!isLoggedIn()) return []
  try {
    const list = JSON.parse(userGetItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveAll(list) {
  if (!isLoggedIn()) return
  userSetItem(KEY, JSON.stringify(list.slice(0, MAX)))
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
  if (!item) return
  const amt = Number(item.amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const brand = detectMerchantBrand(item.merchant, item.raw)
  const who = brand?.name || item.merchant || 'merchant'
  const when = new Date(item.date || Date.now())
  const dateStr = Number.isNaN(when.getTime())
    ? ''
    : when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const timeStr = Number.isNaN(when.getTime())
    ? ''
    : when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const isCredit = item.direction === 'CREDIT'
  const isSelfTransfer = item.kind === 'self_transfer' || item.reason === 'needs_destination'
  const title = isSelfTransfer
    ? 'Moved to your other bank?'
    : isCredit ? 'You were credited' : 'You forgot to add an expense'
  const body = [
    `₹${amt}`,
    isSelfTransfer ? (item.bankLabel || 'Transfer') : who,
    dateStr && timeStr ? `${dateStr} ${timeStr}` : dateStr || timeStr,
    isSelfTransfer ? '— open app: pick account' : '— open app: Add or Scam',
  ].filter(Boolean).join(' · ')

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
        schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
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
  suggestedToAccountId = null,
  pendingSelfTransferId = null,
  matchedDues = null,
  reason = 'needs_confirm',
  date = Date.now(),
}) {
  if (!dedupeKey || !amount || !isLoggedIn()) return null
  const userId = currentUserId()
  const all = loadAll()
  if (all.some((x) => x.dedupeKey === dedupeKey && (x.status === 'pending' || x.status === 'saved' || x.status === 'scam'))) {
    return null
  }
  // Detect brand from merchant + raw only — not from info ("Credit"/"Debit" labels).
  const brand = detectMerchantBrand(merchant, raw)
  const upiRef = captureUpiRef(raw)
  const isCashback = kind === 'cashback'
    || /\bcash\s*back\b|\bone97\b/i.test(String(raw || ''))
  const isRefund = kind === 'refund' || /\brefund(?:ed)?\b|\brevers(?:ed|al)\b/i.test(String(raw || ''))
  const isInterest = kind === 'interest' || /\binterest\b/i.test(String(raw || ''))
  const isSelfTransfer = kind === 'self_transfer' || reason === 'needs_destination'
  const bankBit = bankLabel && bankLabel !== 'PAYTM'
    ? `${String(bankLabel).replace(/\s*bank\s*$/i, '').trim().toUpperCase()} Bank`
    : ''
  const suggestedDescription = isSelfTransfer
    ? 'Transfer between my accounts'
    : direction === 'CREDIT'
      ? (isCashback
        ? [`Cashback: ${brand?.name || merchant || 'Wallet'}`, bankBit].filter(Boolean).join(' · ')
        : isRefund
          ? [`Refund: ${brand?.name || merchant || 'Bank'}`, bankBit].filter(Boolean).join(' · ')
          : isInterest
            ? [`Interest: ${merchant || 'Savings'}`, bankBit].filter(Boolean).join(' · ')
            : [
              brand?.name || merchant || 'Credit',
              upiRef && `UPI ${upiRef}`,
              bankBit,
              accountLast4 && `A/c …${accountLast4}`,
            ].filter(Boolean).join(' · '))
      : (brand ? brand.name : (merchant || ''))

  const item = {
    id: uid(),
    userId,
    dedupeKey,
    status: 'pending',
    amount: Number(Number(amount).toFixed(2)),
    direction: direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    kind: kind || 'payment',
    merchant: merchant || brand?.name || '',
    info: info || '',
    bankLabel: bankLabel || '',
    accountLast4: accountLast4 || '',
    upiRef: upiRef || '',
    raw: String(raw || '').slice(0, 400),
    address: address || '',
    suggestedAccountId,
    suggestedCategoryId,
    suggestedToAccountId,
    pendingSelfTransferId,
    matchedDues: Array.isArray(matchedDues) ? matchedDues.slice(0, 6) : null,
    suggestedDescription,
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

/**
 * After Pay-now SMS is logged, clear any forgot-expense popup for that same debit.
 */
export function dismissSmsMoneyReviewsForSms({ body = '', address = '', amount = null } = {}) {
  const amt = amount != null ? Number(amount) : null
  const normBody = String(body || '').toLowerCase().replace(/\s+/g, ' ').slice(0, 90)
  const addr = String(address || '').toLowerCase().slice(0, 24)
  const all = loadAll()
  let changed = false
  for (let i = 0; i < all.length; i++) {
    const x = all[i]
    if (!x || x.status !== 'pending') continue
    if (x.direction === 'CREDIT') continue
    const sameAmt = amt == null || Math.abs(Number(x.amount) - amt) < 0.011
    const sameBody = normBody
      && String(x.raw || '').toLowerCase().replace(/\s+/g, ' ').includes(normBody.slice(0, 40))
    const sameAddr = !addr || String(x.address || '').toLowerCase().includes(addr)
      || addr.includes(String(x.address || '').toLowerCase().slice(0, 8))
    const sameKey = x.dedupeKey && amt != null
      && x.dedupeKey.startsWith(`${Number(amt).toFixed(2)}|DEBIT|`)
    // Require body or dedupe overlap — never dismiss another same-₹ debit by sender alone
    if (sameAmt && (sameBody || sameKey)) {
      all[i] = { ...x, status: 'dismissed', updatedAt: Date.now(), dismissReason: 'pay_now_sms' }
      changed = true
    }
  }
  if (changed) saveAll(all)
  return changed
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
    const list = JSON.parse(userSessionGetItem(SESSION_SNOOZE_KEY) || '[]')
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

function saveSessionSnooze(set) {
  userSessionSetItem(SESSION_SNOOZE_KEY, JSON.stringify([...set]))
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
