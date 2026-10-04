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

function normalizePersonName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True if SMS payee name looks like the person we paid (payment-request / split). */
export function namesLookSame(a, b) {
  const na = normalizePersonName(a)
  const nb = normalizePersonName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const fa = na.split(' ')[0]
  const fb = nb.split(' ')[0]
  return fa.length >= 3 && fa === fb
}

/**
 * Match a parsed SMS against a pending P2P pay.
 * Amount + time required. VPA and/or payee name strengthen the match.
 * Amount-only match is allowed only when this is the unique waiting pay of that amount
 * (avoids confirming the wrong QR pay when another same-₹ debit arrives).
 */
export function smsMatchesPending(parsed, pending, { allWaiting = null } = {}) {
  if (!parsed || !pending) return false
  if (pending.status !== 'waiting_sms' && pending.status !== 'pending') return false

  const smsAmt = Number(parsed.amount)
  const payAmt = Number(pending.amount)
  if (!Number.isFinite(smsAmt) || !Number.isFinite(payAmt)) return false
  if (Math.abs(smsAmt - payAmt) > 0.011) return false

  const created = Number(pending.createdAt) || 0
  const smsDate = Number(parsed.date) || Date.now()
  if (created && smsDate < created - 2 * 60_000) return false
  const expires = Number(pending.expiresAt) || (created + 24 * 60 * 60_000)
  if (smsDate > expires + 5 * 60_000) return false

  const pendingPa = String(pending.pa || '').toLowerCase().trim()
  const smsPa = String(parsed.pa || '').toLowerCase().trim()
  if (pendingPa && smsPa) {
    if (pendingPa === smsPa) return true
    return false
  }

  const pendingName = pending.pn || pending.name || ''
  const smsName = parsed.payeeName || ''
  if (smsName && pendingName && namesLookSame(smsName, pendingName)) return true

  // For payment requests, require name when SMS has a payee (avoid wrong auto-mark)
  if (pending.kind === 'payment_request' || pending.kind === 'split_bill') {
    if (smsName && pendingName && !namesLookSame(smsName, pendingName)) return false
  }

  // Amount + time only — only if unique waiting pay with this amount
  const peers = (allWaiting || []).filter((p) =>
    p && p.id !== pending.id
    && (p.status === 'waiting_sms' || p.status === 'pending')
    && Math.abs(Number(p.amount) - smsAmt) <= 0.011,
  )
  if (peers.length > 0) return false
  // Prefer some identity signal when SMS has a different payee name
  if (smsName && pendingName && !namesLookSame(smsName, pendingName)) return false
  return true
}

/** Detect UPI / payment failure SMS (no debit happened). */
export function parseUpiPaymentFailedSms({ body = '', address = '', date = 0 } = {}) {
  const text = String(body || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  const lower = text.toLowerCase()
  if (/\botp\b|one[- ]time|verification code/i.test(lower)) return null
  const failed = /\b(?:fail(?:ed|ure)?|unsuccessful|declin(?:ed|e)|reject(?:ed)?|could\s+not\s+be\s+(?:processed|completed)|not\s+successful|txn\s+fail)\b/i.test(lower)
  if (!failed) return null
  // Must look like a payment attempt, not random "failed KYC"
  if (!/\b(?:upi|payment|transaction|txn|transfer|paid|pay)\b/i.test(lower)) return null
  if (/\b(?:kyc|otp|login|password)\b/i.test(lower) && !/\b(?:upi|payment|txn)\b/i.test(lower)) return null

  const amount =
    matchAmount(text, /(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*(?:\.\d{1,2})?)/i)
    || matchAmount(text, /(?:of|for|amount)\s+(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i)
  if (!amount || Number(amount) < 1) return null

  const vpa = capture(text, /([a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63})/)
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
    failed: true,
    source: 'sms',
  }
}

function scorePending(parsed, pending) {
  let score = 0
  const smsPa = String(parsed.pa || '').toLowerCase()
  if (smsPa && String(pending.pa || '').toLowerCase() === smsPa) score += 100
  if (namesLookSame(parsed.payeeName, pending.pn || pending.name)) score += 50
  const smsDate = Number(parsed.date) || Date.now()
  score -= Math.min(40, Math.abs((pending.createdAt || 0) - smsDate) / 60_000)
  return score
}

/** Among matching pendings, pick best (VPA → name → closest time). */
export function pickBestPendingMatch(parsed, pendings) {
  const waiting = pendings || []
  const candidates = waiting.filter((p) => smsMatchesPending(parsed, p, { allWaiting: waiting }))
  if (!candidates.length) return null
  candidates.sort((a, b) => scorePending(parsed, b) - scorePending(parsed, a))
  return candidates[0]
}
