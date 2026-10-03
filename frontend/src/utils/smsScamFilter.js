/**
 * Block fake / scam / spam SMS from being parsed into money events.
 * User "Mark scam" blacklists that sender for this logged-in user only.
 */

import { userGetItem, userSetItem } from './userStorage.js'

const BLOCKED_KEY = 'mm_scam_sms_senders'
const MAX_BLOCKED = 200

function loadBlocked() {
  try {
    const list = JSON.parse(userGetItem(BLOCKED_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveBlocked(list) {
  userSetItem(BLOCKED_KEY, JSON.stringify(list.slice(0, MAX_BLOCKED)))
}

/** Normalize SMS sender for matching (strip +91, spaces). */
export function normalizeSmsSender(address) {
  return String(address || '')
    .trim()
    .toUpperCase()
    .replace(/^\+91/, '')
    .replace(/[\s-]/g, '')
}

export function listBlockedSmsSenders() {
  return loadBlocked()
}

export function isBlockedSmsSender(address) {
  const norm = normalizeSmsSender(address)
  if (!norm) return false
  return loadBlocked().some((b) => {
    const bn = normalizeSmsSender(b.address)
    if (!bn) return false
    return bn === norm || norm.includes(bn) || bn.includes(norm)
  })
}

/**
 * Permanently ignore SMS from this sender (Mark scam).
 */
export function blockSmsSender(address, { reason = 'user_marked', raw = '', amount = null } = {}) {
  const norm = normalizeSmsSender(address)
  if (!norm || norm.length < 3) return null
  const list = loadBlocked().filter((b) => normalizeSmsSender(b.address) !== norm)
  const entry = {
    address: String(address || '').trim(),
    normalized: norm,
    reason,
    raw: String(raw || '').slice(0, 200),
    amount: amount != null ? Number(amount) : null,
    blockedAt: Date.now(),
  }
  list.unshift(entry)
  saveBlocked(list)
  try {
    window.dispatchEvent(new CustomEvent('mm-scam-senders-changed', { detail: { entry } }))
  } catch { /* ignore */ }
  return entry
}

export function unblockSmsSender(address) {
  const norm = normalizeSmsSender(address)
  saveBlocked(loadBlocked().filter((b) => normalizeSmsSender(b.address) !== norm))
}

/** Real money movement verbs — required for bank txn SMS. */
const MONEY_TXN_RE = /\b(?:debited|credited|spent|withdrawn|transferred|auto[- ]?debit|auto[- ]?pay(?:ed)?|mandate(?:\s+debit)?|imps|neft|rtgs|upi\s*ref|txn\s*(?:id|ref)|transaction\s*(?:id|ref)|a\/c\s*[x\d*]+)\b/i

const DEBIT_VERB_RE = /\b(?:debited|spent|withdrawn|auto[- ]?debit|purchase)\b|\bpaid\s+(?:to|from|via|using|rs|₹|inr)\b|\bhas\s+been\s+paid\b|\bsent\s+(?:to|rs|₹|inr)\b/i
const CREDIT_VERB_RE = /\b(?:credited|received|deposited|inward|refund)\b/i

/** True only for real bank debit OR credit movement (not ads / OTP / chatter). */
export function isRealDebitOrCreditSms(body = '') {
  const lower = String(body || '').toLowerCase()
  if (!lower.trim()) return false
  if (/\botp\b|one[- ]time|verification code|do not share/i.test(lower)) return false
  const debit = DEBIT_VERB_RE.test(lower)
  const credit = CREDIT_VERB_RE.test(lower)
  if (!debit && !credit) return false
  // Must have a plausible amount
  if (!/(?:₹|rs\.?\s*|inr\s*)\d|\d[\d,]*(?:\.\d{1,2})?\s*(?:₹|rs\.?|inr)/i.test(body)) {
    return false
  }
  return true
}

/**
 * Marketing / offer / spam ad SMS — not real spends or credits.
 */
export function isPromotionalSms({ body = '', address = '' } = {}) {
  const text = String(body || '').replace(/\s+/g, ' ').trim()
  if (!text) return false
  const lower = text.toLowerCase()
  const addr = String(address || '').toUpperCase()

  // Common AD-/promo sender prefixes on Indian SMS
  if (/\bAD[-_]|[-_]AD\b|^VM[-_]|[-_]VM\b|^JP[-_]/i.test(addr)
      && !DEBIT_VERB_RE.test(lower)
      && !CREDIT_VERB_RE.test(lower)) {
    return true
  }

  const promoRe = [
    /\bonly\s*(?:at\s*)?(?:₹|rs\.?\s*|inr\s*)\d/i,
    /\bstarting\s*(?:at\s*)?(?:₹|rs\.?\s*|inr\s*)\d/i,
    /\bjust\s*(?:₹|rs\.?\s*|inr\s*)\d/i,
    /\bflat\s*(?:₹|rs\.?\s*|inr\s*)\d/i,
    /\bget\s+(?:a\s+)?(?:subscription|membership|plan|offer)\b/i,
    /\bunlock\b.*(?:₹|rs\.?|inr|subscription|membership)/i,
    /\blimited[- ]time\b|\boffer\s*(?:ends|expires|valid)\b/i,
    /\bexclusive\s+offer\b|\bspecial\s+offer\b|\bmega\s+sale\b|\bflash\s+sale\b/i,
    /\bapply\s+now\b|\bjoin\s+now\b|\bsubscribe\s+now\b|\bavail\s+now\b|\bbuy\s+now\b/i,
    /\bcashback\s+up\s+to\b|\bearn\s+up\s+to\b|\bsave\s+up\s+to\b|\bupto\s+\d+%\s+off\b/i,
    /\buse\s+code\b|\bpromo\s*code\b|\bcoupon\b|\bdiscount\s+code\b/i,
    /\bdownload\s+(?:the\s+)?app\b|\binstall\s+(?:the\s+)?app\b/i,
    /\bcred\b.*(?:subscription|membership|club|only|offer|₹\s*99|rs\.?\s*99)/i,
    /\b(?:swiggy|zomato|amazon|flipkart|phonepe|paytm|gpay)\b.*(?:offer|cashback|only\s*(?:at\s*)?(?:₹|rs))/i,
    /\bno\s+cost\s+emi\b.*\boffer\b/i,
    /\bpre[- ]?approved\b|\bpre[- ]?qualif/i,
    /\bshop\s+now\b|\border\s+now\b|\bgrab\s+(?:the\s+)?deal\b/i,
    /\bfree\s+delivery\b|\bextra\s+\d+%\s+off\b/i,
    /\bwin\s+(?:a\s+)?(?:voucher|coupon|gift|iphone)\b/i,
    /\badvertisement\b|\bthis\s+is\s+an?\s+ad\b|\bsponsored\b/i,
  ]

  const looksPromo = promoRe.some((re) => re.test(text))
  const hasMoneyTxn = isRealDebitOrCreditSms(text)
    || MONEY_TXN_RE.test(lower)

  // Offer / ad with a price but no actual debit/credit → ignore
  if (looksPromo && !hasMoneyTxn) return true

  // "subscription … ₹99" style ads without txn markers
  if (/\bsubscription\b|\bmembership\b|\bplan\b/i.test(lower)
      && /(?:₹|rs\.?\s*|inr\s*)\d/i.test(lower)
      && !hasMoneyTxn) {
    return true
  }

  // T&C / unsubscribe marketing footers without txn
  if (/\bunsubscribe\b|\bstop\s+to\s+opt\b|\bt&c\s+apply\b|\breply\s+stop\b/i.test(lower)
      && !hasMoneyTxn) {
    return true
  }

  // Spam-ish: lots of emoji / ALL CAPS short blast with ₹ and no debit/credit
  if (!hasMoneyTxn
      && /(?:₹|rs\.?\s*|inr\s*)\d/i.test(lower)
      && (/(?:🔥|🎉|💰|💥|✨)/.test(text) || (text === text.toUpperCase() && text.length < 160))) {
    return true
  }

  return false
}

/**
 * Heuristic: fake bank / phishing / lottery SMS that should never populate money.
 */
export function isLikelyScamSms({ body = '', address = '' } = {}) {
  const text = String(body || '').replace(/\s+/g, ' ').trim()
  if (!text) return true
  const lower = text.toLowerCase()
  const addr = String(address || '')

  if (isBlockedSmsSender(addr)) return true
  if (isPromotionalSms({ body: text, address: addr })) return true

  // Phishing / urgency / lottery (common India scam SMS)
  // URL + kyc/block / no bank markers — real bank SMS rarely include raw links
  if (/\bhttps?:\/\/|\bwww\./i.test(lower)) {
    if (/\b(?:kyc|blocked|suspend|verify|update|claim|refund|lottery|prize|otp|pin)\b/i.test(lower)) {
      return true
    }
    if (!/\b(?:a\/c|acct|account|upi|imps|neft|rtgs|debited|credited|spent|paid)\b/i.test(lower)) {
      return true
    }
  }

  const scamRe = [
    /\bcongratulations?\b.*\bwon\b/i,
    /\byou (?:have )?won\b.*(?:lottery|prize|reward|cash)/i,
    /\bclaim (?:your )?(?:prize|reward|refund|cash)\b/i,
    /\blottery\b|\bjackpot\b/i,
    /\bclick (?:here|now|link|below)\b/i,
    /\bbit\.ly\b|\btinyurl\b|\bcutt\.ly\b|\bt\.co\/\b/i,
    /\b(?:update|complete|submit) (?:your )?kyc\b/i,
    /\baccount (?:will be |is )?(?:blocked|suspended|closed|deactivated)\b/i,
    /\bsim (?:will be |is )?blocked\b/i,
    /\baadhaar\b.*\b(?:suspend|block|link|update)\b/i,
    /\bpan (?:card )?(?:block|suspend)\b/i,
    /\bincome tax (?:refund|department)\b.*\b(?:click|link|claim)\b/i,
    /\brbi\b.*\b(?:fine|penalty|seize)\b/i,
    /\bshare (?:your )?(?:otp|pin|cvv|password|upi pin)\b/i,
    /\bsend otp\b|\bprovide otp\b/i,
    /\binstall\b.*\.apk\b/i,
    /\bwhatsapp\b.*(?:lottery|prize|gift|won)/i,
    /\bdear customer\b.*\bclick\b/i,
    /\burgent[- ]action\b/i,
    /\bverify (?:now|immediately)\b.*(?:http|www\.)/i,
  ]

  for (const re of scamRe) {
    try {
      if (re.test(text)) return true
    } catch { /* ignore */ }
  }

  // Explicit patterns that are almost never real bank money SMS
  if (/\bcongratulations?\b/i.test(lower) && /(?:₹|rs\.?|inr)/i.test(lower)) return true
  if (/\bfree (?:gift|iphone|reward)\b/i.test(lower)) return true

  // Personal 10-digit mobile as sender + money words + no bank markers → often spam
  const digits = addr.replace(/\D/g, '')
  const isPersonalMobile = /^(?:91)?[6-9]\d{9}$/.test(digits)
  if (isPersonalMobile) {
    const bankLike = /\b(?:a\/c|acct|debited|credited|upi ref|imps|neft|hdfc|icici|sbi|axis|kotak)\b/i.test(lower)
    if (!bankLike) return true
  }

  return false
}

/** True if this SMS should be ignored for money parsing. */
export function shouldIgnoreMoneySms({ body = '', address = '' } = {}) {
  if (isBlockedSmsSender(address)) return true
  if (isPromotionalSms({ body, address })) return true
  if (isLikelyScamSms({ body, address })) return true
  // No debit and no credit → ignore (ads, spam, chatter, OTP already caught above)
  if (!isRealDebitOrCreditSms(body)) return true
  return false
}
