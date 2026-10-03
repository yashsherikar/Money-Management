/**
 * Block fake / scam / spam SMS from being parsed into money events.
 * User "Mark scam" also blacklists that sender address forever (on this device).
 */

const BLOCKED_KEY = 'mm_scam_sms_senders'
const MAX_BLOCKED = 200

function loadBlocked() {
  try {
    const list = JSON.parse(localStorage.getItem(BLOCKED_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveBlocked(list) {
  localStorage.setItem(BLOCKED_KEY, JSON.stringify(list.slice(0, MAX_BLOCKED)))
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

/**
 * Heuristic: fake bank / phishing / lottery SMS that should never populate money.
 */
export function isLikelyScamSms({ body = '', address = '' } = {}) {
  const text = String(body || '').replace(/\s+/g, ' ').trim()
  if (!text) return true
  const lower = text.toLowerCase()
  const addr = String(address || '')

  if (isBlockedSmsSender(addr)) return true

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
  return isLikelyScamSms({ body, address }) || isBlockedSmsSender(address)
}
