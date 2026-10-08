/**
 * Parse Indian bank SMS for autopay / mandate / savings transfers / credit+debit.
 * Covers formats like Paytm Cash/ICICI:
 * "Acct XX043 is credited with Rs 2.00 on 03-Oct-26 from ONE97 COMMUNICA. UPI:307983112766-ICICI Bank."
 */
import { shouldIgnoreMoneySms } from './smsScamFilter.js'

const BANK_HINTS = [
  { id: 'hdfc', labels: ['hdfc', 'hdfcbk', 'hdfcbank'], keywords: ['hdfc'] },
  { id: 'sbi', labels: ['sbi', 'sbiinb', 'sbicap', 'state bank'], keywords: ['sbi', 'state bank'] },
  { id: 'icici', labels: ['icici', 'icicib'], keywords: ['icici'] },
  { id: 'axis', labels: ['axis', 'axisbk', 'axisbank'], keywords: ['axis'] },
  { id: 'kotak', labels: ['kotak', 'kotakbk', 'kbkbank'], keywords: ['kotak'] },
  { id: 'yes', labels: ['yesbank', 'yesbk', 'yes bank'], keywords: ['yes'] },
  { id: 'idfc', labels: ['idfc', 'idfcfirst'], keywords: ['idfc'] },
  { id: 'pnb', labels: ['pnb', 'punjab national'], keywords: ['pnb'] },
  { id: 'bob', labels: ['bob', 'baroda', 'bankofbaroda'], keywords: ['baroda', 'bob'] },
  { id: 'canara', labels: ['canara', 'canarabank'], keywords: ['canara'] },
  { id: 'union', labels: ['unionbank', 'union bk'], keywords: ['union'] },
  { id: 'indusind', labels: ['indusind', 'indusb'], keywords: ['indus'] },
  { id: 'federal', labels: ['federal', 'fedbank'], keywords: ['federal'] },
  { id: 'rbl', labels: ['rbl', 'rblbank'], keywords: ['rbl'] },
  { id: 'paytm', labels: ['paytm', 'one97', 'paytmbank'], keywords: ['paytm'] },
]

// Do NOT treat bare "subscription" as autopay — promo ads say that without a real debit.
const AUTOPAY_RE = /\bauto[- ]?pay\b|\bauto[- ]?debit\b|\bmandate\b|\bstanding instruction\b|\bsi debit\b|\be[- ]?nach\b|\bnach\b|\brecurring\s+(?:payment|debit)\b/i
const SAVINGS_RE = /\bsavings?\b|\bppf\b|\brd\b|\brecurring deposit\b|\bsukanya\b|\bnps\b|\bemergency fund\b|\bsweep\b|\bto your (?:savings|rd|ppf)\b|\bsaved\b/i
const CREDIT_RE = /\bcredited\b|\breceived\b|\bdeposited\b|\binward\b|\brefund(?:ed)?\b|\brevers(?:ed|al)\b|\binterest\b|\bsalary\b|\bcash\s*back\b|\bcashback\b|\bscratch\s*card\b/i
const DEBIT_RE = /\bdebited\b|\bspent\b|\bpaid\s+(?:to|from|via|using|rs|₹|inr)\b|\bhas\s+been\s+paid\b|\bsent\b|\bwithdrawn\b|\bpurchase\b|\bauto[- ]?debit\b|\bemi\b/i
const REFUND_RE = /\brefund(?:ed)?\b|\brevers(?:ed|al)\b|\bcharge\s*back\b|\bamount\s+reversed\b|\btxn\s+reversed\b|\btransaction\s+reversed\b/i
const INTEREST_RE = /\binterest\b|\bint\.?\s+credit\b|\bintrst\b/i

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

export function detectBankFromSms({ body = '', address = '' } = {}) {
  const hay = `${address} ${body}`.toLowerCase()
  for (const b of BANK_HINTS) {
    if (b.labels.some((l) => hay.includes(l))) return b
  }
  return null
}

export function matchAccountToBank(accounts, bank, { preferSavings = false } = {}) {
  if (!accounts?.length) return null
  const pool = preferSavings
    ? accounts.filter((a) => a.type === 'EMERGENCY_FUND' || /saving|ppf|rd|sip|emergency/i.test(a.name || ''))
    : accounts
  const searchIn = pool.length ? pool : accounts

  if (bank) {
    const hit = searchIn.find((a) =>
      bank.keywords.some((k) => String(a.name || '').toLowerCase().includes(k)),
    )
    if (hit) return hit
  }

  if (preferSavings) {
    const sav = accounts.find((a) => a.type === 'EMERGENCY_FUND')
      || accounts.find((a) => /saving|ppf|rd|emergency/i.test(a.name || ''))
    if (sav) return sav
  }

  return accounts.find((a) => a.isPrimary) || accounts.find((a) => a.type === 'BANK') || accounts[0] || null
}

/**
 * @param {{ includeUpiPayment?: boolean }} opts
 *   includeUpiPayment: after P2P match failed, still parse UPI debit/credit for review/auto-log
 * @returns {null | object}
 */
export function parseBankMoneySms({ body = '', address = '', date = 0, includeUpiPayment = false } = {}) {
  const text = String(body || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  const lower = text.toLowerCase()

  if (/\botp\b|one[- ]time|verification code|do not share|avail limit/i.test(lower)) return null
  if (shouldIgnoreMoneySms({ body: text, address })) return null

  // Verb-anchored first: tied to the actual debit/credit action, so it can't accidentally grab
  // an "Avl Bal Rs.X" mention elsewhere in the SMS. The bare currency-symbol pattern used to run
  // first and matched whichever ₹/Rs/INR number appeared earliest in the text — including a
  // balance figure, if the bank's template mentions balance before the transaction amount.
  const amount =
    matchAmount(text, /(?:debited|credited|spent|paid|sent|received|deposited|won)\s+(?:for\s+)?(?:by\s+)?(?:with\s+)?(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i, 0.01)
    || matchAmountAvoidingBalance(text, /(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*(?:\.\d{1,2})?)/i, 0.01)
    || matchAmount(text, /(?:by|of|for)\s+(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i, 0.01)
  if (!amount || Number(amount) < 0.01) return null

  const looksCashbackWording = /\bcash\s*back\b|\bcashback\b|\bscratch\s*card\b|\bscratchcard\b|\breward\s+credit/i.test(lower)
  const isCredit = (CREDIT_RE.test(lower) || looksCashbackWording) && !DEBIT_RE.test(lower)
  const isDebit = DEBIT_RE.test(lower)
    || (/\b(?:debited|spent|withdrawn|auto[- ]?debit)\b/i.test(lower))
    || (!isCredit
      && /\b(?:upi\s*ref|txn\s*(?:id|ref)|imps|neft|rtgs)\b/i.test(lower)
      && /(?:₹|rs\.?\s*|inr\s*)\d/i.test(text)
      && /\ba\/c\b|\bacct\b|\baccount\b|\bupi\b/i.test(lower))
  if (!isCredit && !isDebit) return null
  // Debits under ₹1 are noise; cashback/credits can be paise (₹0.50 etc.)
  if (isDebit && !isCredit && Number(amount) < 1) return null

  const direction = isCredit ? 'CREDIT' : 'DEBIT'
  const bank = detectBankFromSms({ body: text, address })
  const isAutopay = AUTOPAY_RE.test(lower)
  const isSavings = SAVINGS_RE.test(lower)

  // "from ONE97 COMMUNICA." / "to MERCHANT" / "paid to X"
  let merchant =
    capture(text, /\bfrom\s+([A-Za-z0-9][A-Za-z0-9 ._'&@-]{1,47}?)(?:\s*\.|,\s*UPI|\s+UPI\b|\s+on\b|\s+via\b|\s+Ref\b|$)/i)
    || capture(text, /(?:to|towards|paid to|sent to|for)\s+([A-Za-z0-9 ._'&@-]{2,48}?)(?:\s+on\b|\s+via\b|\s+using\b|\s+upi\b|\s+ref\b|[.,]|$)/i)
    // NACH/mandate/UPI AutoPay wording often doesn't use the connectors above:
    // "e-mandate towards NETFLIX", "requested by NETFLIX", "in favour of NETFLIX"
    || capture(text, /\bmandate\b.{0,20}?(?:for|towards)\s+([A-Za-z0-9][A-Za-z0-9 ._'&-]{1,47}?)(?:\s+on\b|\s+via\b|\s+ref\b|[.,]|$)/i)
    || capture(text, /\brequested by\s+([A-Za-z0-9][A-Za-z0-9 ._'&-]{1,47}?)(?:\s+on\b|\s+via\b|\s+ref\b|[.,]|$)/i)
    || capture(text, /\bin favou?r of\s+([A-Za-z0-9][A-Za-z0-9 ._'&-]{1,47}?)(?:\s+on\b|\s+via\b|\s+ref\b|[.,]|$)/i)
    || ''
  merchant = cleanMerchant(merchant)

  const isCashback = isCredit && isCashbackCredit({ lower, merchant, text })
  const isRefund = isCredit && REFUND_RE.test(lower) && !isCashback
  const isInterest = isCredit && INTEREST_RE.test(lower) && !isCashback && !isRefund

  const isTransferWording = /\bneft\b|\bimps\b|\brtgs\b|\btransferred\b|\btransfer\b|\bself\s*transfer\b|\bto\s+self\b|\bown\s+a\/c\b|\bown\s+account\b/i.test(lower)

  let kind = 'payment'
  if (isCashback) kind = 'cashback'
  else if (isRefund) kind = 'refund'
  else if (isInterest) kind = 'interest'
  else if (isAutopay && isSavings) kind = 'savings'
  else if (isAutopay) kind = 'autopay'
  else if (isSavings) kind = 'savings'
  else if (isTransferWording) kind = 'transfer'

  // Plain UPI one-offs: skip unless caller already tried P2P match (includeUpiPayment)
  // Credits / cashback with UPI always parse
  if (kind === 'payment' && /\bupi\b/i.test(lower) && !isAutopay && !isSavings && !isCredit && !includeUpiPayment) {
    return null
  }

  // Acct XX043 / A/c XX1234 / account ending 1234
  const accountLast4 =
    capture(text, /\b(?:a\/c|acct|account)\s*(?:no\.?\s*)?(?:x+|X+)?(\d{3,4})\b/i)
    || capture(text, /\b(?:xx|x{2,})(\d{3,4})\b/i)
    || ''

  const upiRef =
    capture(text, /\bupi\s*[:\-]?\s*([0-9]{6,22})/i)
    || capture(text, /\bupi\s*ref(?:erence)?\s*(?:no\.?|number)?\s*[:\-]?\s*([a-z0-9]{6,22})/i)
    || ''

  const smsDateMs = parseSmsDate(text) || Number(date) || Date.now()
  const bankLabel = bank
    ? (bank.id === 'paytm' ? 'PAYTM' : bank.id.toUpperCase())
    : (guessBankFromBody(text) || guessBankLabel(address))

  const infoParts = [
    bankLabel && `Bank: ${bankLabel}`,
    accountLast4 && `A/c …${accountLast4}`,
    kind === 'cashback' ? 'Cashback'
      : kind === 'refund' ? 'Refund'
        : kind === 'interest' ? 'Interest'
          : (direction === 'CREDIT' ? 'Credit' : 'Debit'),
    upiRef && `UPI ${upiRef}`,
    kind === 'autopay' && 'Autopay',
    kind === 'savings' && 'Savings',
    kind === 'transfer' && 'Transfer',
  ].filter(Boolean)

  return {
    direction,
    kind,
    amount,
    bank,
    bankLabel,
    accountLast4: accountLast4 || '',
    upiRef: upiRef || '',
    merchant,
    info: infoParts.join(' · '),
    raw: text.slice(0, 500),
    address: String(address || ''),
    date: smsDateMs,
    source: 'sms',
  }
}

function cleanMerchant(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .replace(/\bUPI\b.*$/i, '')
    .trim()
}

/**
 * Paytm / PhonePe / wallet cashback credits often look like:
 * "credited with Rs 2.00 … from ONE97 COMMUNICA. UPI:…"
 * "Congratulations! You won Rs.5 cashback on Paytm"
 * (may not literally say "cashback" in the bank SMS).
 */
function isCashbackCredit({ lower = '', merchant = '', text = '' } = {}) {
  if (/\bcash\s*back\b|\bcashback\b|\breward\s+point|\breward\s+credit\b|\bcashback\s+credited\b|\bscratch\s*card\b|\bscratchcard\b/i.test(lower)) {
    return true
  }
  // "won Rs.5" / "earned Rs.75" + wallet/UPI brand without the word cashback
  if (/\b(?:won|win|earned|earn)\b/i.test(lower)
      && /\b(?:paytm|one97|phonepe|gpay|google\s*pay|amazon\s*pay|bhim|npci)\b/i.test(lower)
      && /(?:₹|rs\.?\s*|inr\s*)\d/i.test(text)) {
    return true
  }
  // Wallet / BHIM corporate credits that look like rewards (not large P2P)
  const from = `${merchant} ${text}`.toLowerCase()
  if (/\b(?:one97|bhim|npci)\b/i.test(from)
      && (/\bupi\b/i.test(lower) || /\bcredited\b|\breceived\b|\breward\b/i.test(lower))) {
    const m = text.match(/(?:₹|rs\.?\s*|inr\s*)\s*(\d[\d,]*(?:\.\d{1,2})?)/i)
    const amt = m ? Number(String(m[1]).replace(/,/g, '')) : null
    // BHIM/Paytm cashback often ₹1–₹100; keep under typical P2P transfers
    if (amt != null && amt > 0 && amt <= 200) return true
  }
  return false
}

/** "on 03-Oct-26" / "on 03-Oct-2026" / "on 03/10/26" */
function parseSmsDate(text) {
  const m1 = text.match(/\bon\s+(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})\b/i)
  if (m1) {
    const day = Number(m1[1])
    const mon = MONTHS[m1[2].slice(0, 3).toLowerCase()]
    let year = Number(m1[3])
    if (year < 100) year += 2000
    if (mon != null && day >= 1 && day <= 31) {
      const d = new Date(year, mon, day, 12, 0, 0)
      if (!Number.isNaN(d.getTime())) return d.getTime()
    }
  }
  const m2 = text.match(/\bon\s+(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/)
  if (m2) {
    const day = Number(m2[1])
    const mon = Number(m2[2]) - 1
    let year = Number(m2[3])
    if (year < 100) year += 2000
    const d = new Date(year, mon, day, 12, 0, 0)
    if (!Number.isNaN(d.getTime())) return d.getTime()
  }
  return 0
}

function guessBankFromBody(text) {
  const m = text.match(/\b(ICICI|HDFC|SBI|AXIS|KOTAK|YES|IDFC|PNB|Paytm)\s*Bank\b/i)
  return m ? m[1].toUpperCase() : ''
}

function guessBankLabel(address) {
  const a = String(address || '').toUpperCase()
  if (!a) return ''
  const m = a.match(/(?:AX|AD|VK|BP|JD|TM)-([A-Z0-9]{3,12})/)
  return m ? m[1] : a.slice(0, 12)
}

function matchAmount(text, re, min = 1) {
  const m = text.match(re)
  if (!m) return null
  const n = Number(String(m[1]).replace(/,/g, ''))
  if (!Number.isFinite(n) || n < min) return null
  return n.toFixed(2)
}

/** Same as matchAmount, but walks every occurrence and skips any that sit right after a
 *  balance-ish word ("Avl Bal Rs.12,345", "Available balance is Rs 500") so a bank template
 *  that mentions balance before (or instead of alongside) the transaction amount can't
 *  accidentally have its balance figure picked up as the transaction amount. */
function matchAmountAvoidingBalance(text, re, min = 1) {
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
  let m
  while ((m = global.exec(text)) !== null) {
    const start = Math.max(0, m.index - 20)
    const context = text.slice(start, m.index)
    if (!/\bbal(?:ance)?\b|\bavl\b|\bavail(?:able)?\b/i.test(context)) {
      const n = Number(String(m[1]).replace(/,/g, ''))
      if (Number.isFinite(n) && n >= min) return n.toFixed(2)
    }
    if (m.index === global.lastIndex) global.lastIndex++ // avoid infinite loop on zero-width match
  }
  return null
}

function capture(text, re) {
  const m = text.match(re)
  return m ? String(m[1]).trim() : ''
}

/**
 * True when SMS looks like money moved between banks (IMPS/NEFT/RTGS/transfer),
 * not cashback / autopay / merchant spend.
 */
export function isSelfTransferCandidate(parsed) {
  if (!parsed) return false
  if (parsed.kind === 'cashback' || parsed.kind === 'refund' || parsed.kind === 'interest'
      || parsed.kind === 'autopay' || parsed.kind === 'savings') {
    return false
  }
  if (parsed.kind === 'transfer' || parsed.kind === 'self_transfer') return true
  const lower = String(parsed.raw || '').toLowerCase()
  return /\bneft\b|\bimps\b|\brtgs\b|\bself\s*transfer\b|\bto\s+self\b|\bown\s+a\/c\b|\bown\s+account\b/i.test(lower)
}

/**
 * Find another of the user's accounts mentioned in the SMS (destination / source bank).
 */
export function findLinkedAccountInSms(parsed, accounts, excludeAccountId = null) {
  if (!parsed || !accounts?.length) return null
  const hay = `${parsed.merchant || ''} ${parsed.raw || ''} ${parsed.bankLabel || ''}`.toLowerCase()
  const excl = excludeAccountId != null ? String(excludeAccountId) : null

  // Prefer bank keyword that appears in SMS and matches a different account name
  for (const b of BANK_HINTS) {
    if (!b.keywords.some((k) => hay.includes(k)) && !b.labels.some((l) => hay.includes(l))) {
      continue
    }
    const hit = accounts.find((a) => {
      if (excl && String(a.id) === excl) return false
      const name = String(a.name || '').toLowerCase()
      return b.keywords.some((k) => name.includes(k))
    })
    if (hit) return hit
  }

  // Account name token present in SMS body
  for (const a of accounts) {
    if (excl && String(a.id) === excl) continue
    const name = String(a.name || '').toLowerCase().trim()
    if (name.length < 3) continue
    if (hay.includes(name)) return a
    const token = name.split(/\s+/)[0]
    if (token.length >= 4 && hay.includes(token)) return a
  }
  return null
}

/**
 * Classify SMS as a self-transfer between the user's own accounts (2+ accounts required).
 * @returns {null | { fromAccount, toAccount, smsAccount, needsDestination }}
 */
export function classifySelfTransfer(parsed, accounts) {
  if (!parsed || !accounts?.length || accounts.length < 2) return null
  if (parsed.kind === 'cashback' || parsed.kind === 'refund' || parsed.kind === 'interest'
      || parsed.kind === 'autopay' || parsed.kind === 'savings') {
    return null
  }

  const explicit = isSelfTransferCandidate(parsed)
  const smsAccount = matchAccountToBank(accounts, parsed.bank, { preferSavings: false })
    || matchAccountToBank(accounts, parsed.bank, { preferSavings: true })
  if (!smsAccount) return null

  let other = findLinkedAccountInSms(parsed, accounts, smsAccount.id)
  let inferred = false

  // Plain UPI without transfer wording: only if another of our banks is named
  if (!explicit && !other) return null

  // Exactly two accounts + transfer wording, counterpart not named in the SMS →
  // guess it's the other account. Good enough to log a generic transfer pair, but
  // NOT a safe enough signal to silently auto-confirm an Emergency Fund plan on
  // (an unrelated IMPS/NEFT to someone else could otherwise get misattributed).
  if (!other && explicit && accounts.length === 2) {
    other = accounts.find((a) => String(a.id) !== String(smsAccount.id)) || null
    inferred = !!other
  }

  if (parsed.direction === 'DEBIT') {
    return {
      fromAccount: smsAccount,
      toAccount: other || null,
      smsAccount,
      needsDestination: !other,
      inferred,
    }
  }
  return {
    fromAccount: other || null,
    toAccount: smsAccount,
    smsAccount,
    needsDestination: !other,
    inferred,
  }
}

/** Description used for both legs — excluded from income/expense dashboard totals. */
export function transferDescription(fromName, toName) {
  const a = String(fromName || 'Bank').trim() || 'Bank'
  const b = String(toName || 'Bank').trim() || 'Bank'
  return `Transfer: ${a} → ${b}`.slice(0, 220)
}

export function isTransferDescription(description) {
  return /^transfer\s*:/i.test(String(description || '').trim())
}
