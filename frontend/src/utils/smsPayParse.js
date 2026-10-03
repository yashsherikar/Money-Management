/**
 * Parse bank / UPI debit SMS for payment confirmation.
 * Covers common Indian bank formats (amount + debit/spent/paid/UPI).
 */
import { shouldIgnoreMoneySms } from './smsScamFilter.js'

export function parseBankPaymentSms({ body = '', address = '', date = 0 } = {}) {
  const text = String(body || '').replace(/\s+/g, ' ').trim()
  if (!text) return null

  const lower = text.toLowerCase()
  // Skip OTP / scam / credit-only / cashback
  if (/\botp\b|one[- ]time|verification code|do not share/i.test(lower)) return null
  if (shouldIgnoreMoneySms({ body: text, address })) return null
  if (/\bcredited\b|\breceived\b|\bdeposited\b|\bcashback\b/i.test(lower)
      && !/\bdebited\b|\bspent\b|\bpaid\b|\bsent\b|\bwithdrawn\b/i.test(lower)) {
    return null
  }

  // Real debit only — ignore promo SMS that just mention ₹ / UPI / "paid"
  const isDebit = /\bdebited\b|\bspent\b|\bpaid\s+(?:to|from|via|using|rs|₹|inr)\b|\bhas\s+been\s+paid\b|\bsent\b|\bwithdrawn\b|\bpurchase\b|\bupi\s*ref\b|\bimps\b|\bneft\b/i.test(lower)
  if (!isDebit) return null

  const amount =
    matchAmount(text, /(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*(?:\.\d{1,2})?)/i)
    || matchAmount(text, /(?:debited|spent|paid|sent|withdrawn)\s+(?:for\s+)?(?:by\s+)?(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i)
    || matchAmount(text, /(?:by|of)\s+(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i)
    || matchAmount(text, /(\d[\d,]*(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)/i)
  if (!amount || Number(amount) < 1) return null

  // Prefer VPA; also catch "UPI-name@bank" style
  const vpa =
    capture(text, /([a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63})/)
    || capture(text, /upi[_/-]?([a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,63})/i)
  const payeeName =
    capture(text, /(?:to|towards|paid to|sent to)\s+([A-Za-z0-9 ._'&@-]{2,50}?)(?:\s+on\b|\s+via\b|\s+using\b|\s+upi\b|[.,]|$)/i)
    || ''

  return {
    amount,
    pa: (vpa || '').toLowerCase(),
    payeeName: payeeName.replace(/\s+/g, ' ').trim(),
    address: String(address || ''),
    date: Number(date) || Date.now(),
    raw: text.slice(0, 500),
    source: 'sms',
  }
}

function matchAmount(text, re) {
  const m = text.match(re)
  if (!m) return null
  const n = Number(String(m[1]).replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 1) return null
  return n.toFixed(2)
}

function capture(text, re) {
  const m = text.match(re)
  return m ? String(m[1]).trim() : ''
}

/**
 * Match a parsed SMS against a pending P2P pay.
 * Amount must match. VPA match is a strong bonus but optional (many banks omit VPA).
 * Allows late SMS: any time from 2 min before pay up to pending.expiresAt.
 */
export function smsMatchesPending(parsed, pending) {
  if (!parsed || !pending) return false
  if (pending.status !== 'waiting_sms' && pending.status !== 'pending') return false

  const smsAmt = Number(parsed.amount)
  const payAmt = Number(pending.amount)
  if (!Number.isFinite(smsAmt) || !Number.isFinite(payAmt)) return false
  if (Math.abs(smsAmt - payAmt) > 0.011) return false

  const created = Number(pending.createdAt) || 0
  const smsDate = Number(parsed.date) || Date.now()
  // SMS can arrive late (5–15+ min). Accept from 2 min before create until expiry.
  if (created && smsDate < created - 2 * 60_000) return false
  const expires = Number(pending.expiresAt) || (created + 24 * 60 * 60_000)
  if (smsDate > expires + 5 * 60_000) return false

  const pendingPa = String(pending.pa || '').toLowerCase().trim()
  const smsPa = String(parsed.pa || '').toLowerCase().trim()
  if (pendingPa && smsPa) {
    if (pendingPa === smsPa) return true
    // Different VPA in SMS → not this pay
    return false
  }

  // No VPA in SMS: amount + time window is enough for single pending;
  // if multiple pending share same amount, prefer closest createdAt.
  return true
}

/** Among matching pendings with same amount, pick best (VPA match, then closest time). */
export function pickBestPendingMatch(parsed, pendings) {
  const candidates = (pendings || []).filter((p) => smsMatchesPending(parsed, p))
  if (!candidates.length) return null
  const smsPa = String(parsed.pa || '').toLowerCase()
  const withVpa = candidates.filter((p) => smsPa && String(p.pa || '').toLowerCase() === smsPa)
  const pool = withVpa.length ? withVpa : candidates
  const smsDate = Number(parsed.date) || Date.now()
  pool.sort((a, b) => Math.abs((a.createdAt || 0) - smsDate) - Math.abs((b.createdAt || 0) - smsDate))
  return pool[0]
}
