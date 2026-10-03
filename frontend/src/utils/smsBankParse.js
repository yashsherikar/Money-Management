/**
 * Parse Indian bank SMS for autopay / mandate / savings transfers / credit+debit.
 * Returns null for OTP, scam/spam, or unrelated messages.
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
]

const AUTOPAY_RE = /\bauto[- ]?pay\b|\bauto[- ]?debit\b|\bmandate\b|\bstanding instruction\b|\bsi debit\b|\be[- ]?nach\b|\bnach\b|\bsubscription\b|\brecurring\b/i
const SAVINGS_RE = /\bsavings?\b|\bppf\b|\brd\b|\brecurring deposit\b|\bsukanya\b|\bnps\b|\bemergency fund\b|\bsweep\b|\bto your (?:savings|rd|ppf)\b|\bsaved\b/i
const CREDIT_RE = /\bcredited\b|\breceived\b|\bdeposited\b|\binward\b|\brefund\b|\bsalary\b/i
const DEBIT_RE = /\bdebited\b|\bspent\b|\bpaid\b|\bsent\b|\bwithdrawn\b|\bpurchase\b|\bauto[- ]?debit\b|\bemi\b/i

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

  const amount =
    matchAmount(text, /(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*(?:\.\d{1,2})?)/i)
    || matchAmount(text, /(?:debited|credited|spent|paid|sent|received|deposited)\s+(?:for\s+)?(?:by\s+)?(?:with\s+)?(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i)
    || matchAmount(text, /(?:by|of|for)\s+(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i)
  if (!amount || Number(amount) < 1) return null

  const isCredit = CREDIT_RE.test(lower) && !DEBIT_RE.test(lower)
  const isDebit = DEBIT_RE.test(lower)
    || (!isCredit && /(?:₹|rs\.?\s*|inr\s*)\d/i.test(text) && /\ba\/c\b|\baccount\b|\bupi\b/i.test(lower))
  if (!isCredit && !isDebit) return null

  const direction = isCredit ? 'CREDIT' : 'DEBIT'
  const bank = detectBankFromSms({ body: text, address })
  const isAutopay = AUTOPAY_RE.test(lower)
  const isSavings = SAVINGS_RE.test(lower)

  let kind = 'payment'
  if (isAutopay && isSavings) kind = 'savings'
  else if (isAutopay) kind = 'autopay'
  else if (isSavings) kind = 'savings'
  else if (/\bneft\b|\bimps\b|\brtgs\b|\btransferred\b|\btransfer\b/i.test(lower)) kind = 'transfer'

  // Plain UPI one-offs: skip unless caller already tried P2P match (includeUpiPayment)
  if (kind === 'payment' && /\bupi\b/i.test(lower) && !isAutopay && !isSavings && !includeUpiPayment) {
    return null
  }

  const merchant =
    capture(text, /(?:to|towards|paid to|sent to|for)\s+([A-Za-z0-9 ._'&@-]{2,48}?)(?:\s+on\b|\s+via\b|\s+using\b|\s+upi\b|\s+ref\b|[.,]|$)/i)
    || capture(text, /(?:from)\s+([A-Za-z0-9 ._'&@-]{2,48}?)(?:\s+on\b|\s+via\b|[.,]|$)/i)
    || ''

  const accountLast4 = capture(text, /(?:a\/c|acct|account|xx|x{2,})[^\d]*(\d{4})\b/i)

  const bankLabel = bank ? bank.id.toUpperCase() : guessBankLabel(address)
  const infoParts = [
    bankLabel && `Bank: ${bankLabel}`,
    accountLast4 && `A/c …${accountLast4}`,
    direction === 'CREDIT' ? 'Credit' : 'Debit',
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
    merchant: merchant.replace(/\s+/g, ' ').trim(),
    info: infoParts.join(' · '),
    raw: text.slice(0, 500),
    address: String(address || ''),
    date: Number(date) || Date.now(),
    source: 'sms',
  }
}

function guessBankLabel(address) {
  const a = String(address || '').toUpperCase()
  if (!a) return ''
  const m = a.match(/(?:AX|AD|VK|BP|JD|TM)-([A-Z0-9]{3,12})/)
  return m ? m[1] : a.slice(0, 12)
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
