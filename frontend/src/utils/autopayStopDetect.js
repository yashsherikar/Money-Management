/**
 * Detect autopay / mandate / subscription STOPPED or CANCELLED SMS
 * and pause the matching Subscription in Recurring.
 */
import client from '../api/client'
import { detectSubscriptionBrand } from './subscriptionBrands.jsx'
import { isSubscriptionRecurring } from './subscriptionBrands.jsx'
import { cancelSubscriptionReminders } from './subscriptionReminders.js'
import { addLocalAppNotification } from './localAppNotifications.js'
import { smsDedupeKey } from './smsMoneyReview.js'

const SEEN_KEY = 'mm_autopay_stop_seen'
const PAUSE_META_KEY = 'mm_subscription_pause_meta'

const STOP_PATTERNS = [
  /\b(?:auto[- ]?pay|auto[- ]?debit|mandate|e-?nach|nach|standing instruction|\bsi\b|subscription)\b[\s\S]{0,60}\b(?:cancel(?:led|lation)?|stopped|revoked|discontinued|deactivated|disabled|removed|terminated)\b/i,
  /\b(?:cancel(?:led|lation)?|stopped|revoked|discontinued|deactivated)\b[\s\S]{0,60}\b(?:auto[- ]?pay|auto[- ]?debit|mandate|e-?nach|nach|standing instruction|subscription)\b/i,
  /\bmandate\s+(?:has\s+been\s+)?(?:cancel(?:led)?|revoked|failed|rejected)\b/i,
  /\byour\s+subscription\s+(?:has\s+been\s+)?(?:cancel(?:led)?|stopped|ended)\b/i,
  /\bauto[- ]?pay\s+(?:has\s+been\s+)?(?:turned\s+off|disabled|stopped|cancel(?:led)?)\b/i,
  /\binsufficient\s+(?:funds?|balance).{0,40}\b(?:auto[- ]?pay|auto[- ]?debit|mandate)\b/i,
  /\b(?:auto[- ]?pay|auto[- ]?debit|mandate).{0,40}\binsufficient\s+(?:funds?|balance)\b/i,
]

function loadSeen() {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

function rememberSeen(key) {
  const seen = loadSeen()
  seen.add(key)
  const arr = [...seen]
  while (arr.length > 200) arr.shift()
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr))
}

export function getSubscriptionPauseMeta(recurringId) {
  try {
    const map = JSON.parse(localStorage.getItem(PAUSE_META_KEY) || '{}')
    return map[String(recurringId)] || null
  } catch {
    return null
  }
}

function setPauseMeta(recurringId, meta) {
  try {
    const map = JSON.parse(localStorage.getItem(PAUSE_META_KEY) || '{}')
    map[String(recurringId)] = { ...meta, at: Date.now() }
    localStorage.setItem(PAUSE_META_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent('mm-subscription-pause-changed'))
  } catch { /* ignore */ }
}

export function clearSubscriptionPauseMeta(recurringId) {
  try {
    const map = JSON.parse(localStorage.getItem(PAUSE_META_KEY) || '{}')
    delete map[String(recurringId)]
    localStorage.setItem(PAUSE_META_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

export function isAutopayStopSms({ body = '', address = '' } = {}) {
  const text = String(body || '').replace(/\s+/g, ' ').trim()
  if (!text) return false
  if (/\botp\b|one[- ]time|verification code/i.test(text)) return false
  return STOP_PATTERNS.some((re) => re.test(text))
}

function matchAmount(text) {
  const m = text.match(/(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*(?:\.\d{1,2})?)/i)
  if (!m) return null
  const n = Number(String(m[1]).replace(/,/g, ''))
  return Number.isFinite(n) && n >= 1 ? n : null
}

/**
 * Pause matching subscription when SMS says autopay stopped/cancelled.
 */
export async function processAutopayStopSms(msg) {
  if (!localStorage.getItem('token')) return null
  const body = msg?.body || msg?.text || ''
  const address = msg?.address || ''
  if (!isAutopayStopSms({ body, address })) return null

  const text = String(body).replace(/\s+/g, ' ').trim()
  const brand = detectSubscriptionBrand(text, address)
  const amount = matchAmount(text)
  const key = smsDedupeKey({
    amount: amount || 0,
    direction: 'STOP',
    body: text,
    address,
  })
  if (loadSeen().has(key)) return null
  rememberSeen(key)

  let list = []
  try {
    const { data } = await client.get('/recurring-transactions')
    list = (data || []).filter((r) => r.active && isSubscriptionRecurring(r))
  } catch {
    return null
  }
  if (!list.length) return null

  let match = null
  if (brand) {
    const name = brand.name.toLowerCase()
    match = list.find((r) => String(r.description || '').toLowerCase().includes(name))
  }
  if (!match && amount) {
    const sameAmt = list.filter((r) => Math.abs(Number(r.amount) - amount) < 0.02)
    if (sameAmt.length === 1) match = sameAmt[0]
  }
  // Single active subscription + stop SMS about autopay generally
  if (!match && list.length === 1 && /\b(?:auto[- ]?pay|mandate|subscription)\b/i.test(text)) {
    match = list[0]
  }
  if (!match) return null

  try {
    await client.patch(`/recurring-transactions/${match.id}/active?active=false`)
  } catch (err) {
    return { error: err?.message || 'pause_failed', recurring: match }
  }

  await cancelSubscriptionReminders(match.id).catch(() => {})

  const reason = /\binsufficient\b/i.test(text)
    ? 'autopay_failed_funds'
    : 'autopay_stopped'

  setPauseMeta(match.id, {
    reason,
    brand: brand?.name || null,
    smsRaw: text.slice(0, 300),
    amount: amount || match.amount,
  })

  const label = brand?.name
    || String(match.description || '').replace(/^(Subscription|Autopay):\s*/i, '')
    || 'Subscription'

  addLocalAppNotification({
    title: reason === 'autopay_failed_funds' ? 'Autopay failed' : 'Autopay stopped',
    body: `${label} was paused in the app. Resume in Recurring if you restart it.`,
    url: '/recurring',
    kind: 'subscription_stopped',
    relatedId: String(match.id),
  })

  try {
    window.dispatchEvent(new CustomEvent('mm-autopay-stopped', {
      detail: { recurring: match, brand, reason },
    }))
    window.dispatchEvent(new Event('mm-transactions-changed'))
  } catch { /* ignore */ }

  return { paused: true, recurring: match, brand, reason }
}
