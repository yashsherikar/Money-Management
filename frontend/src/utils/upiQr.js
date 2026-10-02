/** Map UPI MCC (merchant category code) → default category name in this app. */
const MCC_TO_CATEGORY = {
  '5411': 'Groceries', '5422': 'Groceries', '5441': 'Groceries', '5451': 'Groceries',
  '5462': 'Groceries', '5499': 'Groceries',
  '5812': 'Dining Out', '5813': 'Dining Out', '5814': 'Dining Out',
  '4111': 'Transport', '4121': 'Transport', '4131': 'Transport', '4789': 'Transport',
  '5541': 'Transport', '5542': 'Transport', '7523': 'Transport',
  '5122': 'Healthcare', '5912': 'Healthcare', '8011': 'Healthcare', '8021': 'Healthcare',
  '8041': 'Healthcare', '8050': 'Healthcare', '8062': 'Healthcare', '8099': 'Healthcare',
  '4814': 'Utilities', '4899': 'Utilities', '4900': 'Utilities',
  '5300': 'Shopping', '5311': 'Shopping', '5331': 'Shopping', '5399': 'Shopping',
  '5611': 'Shopping', '5621': 'Shopping', '5631': 'Shopping', '5641': 'Shopping',
  '5651': 'Shopping', '5661': 'Shopping', '5691': 'Shopping', '5699': 'Shopping',
  '5732': 'Shopping', '5733': 'Shopping', '5941': 'Shopping', '5942': 'Shopping',
  '5944': 'Shopping', '5945': 'Shopping', '5947': 'Shopping', '5977': 'Shopping',
  '7832': 'Entertainment', '7841': 'Entertainment', '7922': 'Entertainment',
  '7996': 'Entertainment', '7999': 'Entertainment',
  '3000': 'Travel', '4511': 'Travel', '4722': 'Travel', '7011': 'Travel',
  '8211': 'Education', '8220': 'Education', '8241': 'Education', '8244': 'Education', '8299': 'Education',
  '6300': 'Insurance',
  '4816': 'Subscriptions', '5734': 'Subscriptions', '5815': 'Subscriptions',
  '5816': 'Subscriptions', '5817': 'Subscriptions', '5818': 'Subscriptions',
}

const MERCHANT_CAT_KEY = 'upiMerchantCategoryByPa'

/** Soft ceiling shown in-app before opening GPay (P2P banks often cap ~₹1L). */
export const UPI_MAX_AMOUNT = 100000

/** MCC missing / 0000 / 0 → person-to-person UPI, not a merchant QR. */
export function isPersonalUpi(mcc) {
  if (mcc == null || String(mcc).trim() === '') return true
  return /^0+$/.test(String(mcc).trim())
}

export function categoryNameForMcc(mcc) {
  if (isPersonalUpi(mcc)) return null
  const code = String(mcc).trim()
  return MCC_TO_CATEGORY[code] || null
}

export function recallMerchantCategoryId(pa) {
  if (!pa) return null
  try {
    const map = JSON.parse(localStorage.getItem(MERCHANT_CAT_KEY) || '{}')
    return map[pa.toLowerCase()] || null
  } catch {
    return null
  }
}

export function rememberMerchantCategoryId(pa, categoryId) {
  if (!pa || !categoryId) return
  try {
    const map = JSON.parse(localStorage.getItem(MERCHANT_CAT_KEY) || '{}')
    map[pa.toLowerCase()] = String(categoryId)
    localStorage.setItem(MERCHANT_CAT_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(String(value).replace(/\+/g, ' ')).trim()
  } catch {
    return String(value || '').replace(/\+/g, ' ').trim()
  }
}

function queryParam(raw, name) {
  if (!raw) return ''
  const m = String(raw).match(new RegExp(`[?&]${name}=([^&]*)`, 'i'))
  return m ? decodeURIComponentSafe(m[1]) : ''
}

/** Normalize VPA: trim, decode %40, keep local-part as typed, handle as-is for banks. */
export function normalizeVpa(pa) {
  let v = String(pa || '').trim()
  if (!v) return ''
  if (/%40/i.test(v)) v = decodeURIComponentSafe(v)
  // Strip accidental wrappers
  v = v.replace(/^upi:\/\/pay\?pa=/i, '').split('&')[0].trim()
  return v
}

/**
 * Parse a UPI QR payload into fields.
 */
export function parseUpiQr(raw) {
  const text = String(raw || '').trim()
  if (!text) throw new Error('Empty QR')

  let urlText = text
  const lower = text.toLowerCase()
  if (!lower.startsWith('upi://')) {
    const idx = lower.indexOf('upi://')
    if (idx >= 0) urlText = text.slice(idx)
    else throw new Error('Not a UPI QR code')
  }

  let params
  try {
    params = new URL(urlText).searchParams
  } catch {
    const q = urlText.includes('?') ? urlText.slice(urlText.indexOf('?') + 1) : ''
    params = new URLSearchParams(q)
  }

  const pa = normalizeVpa(params.get('pa') || '')
  if (!pa) throw new Error('QR has no UPI ID (pa)')
  if (!pa.includes('@')) throw new Error('UPI ID looks invalid (missing @)')
  if (/%40/i.test(pa)) throw new Error('UPI ID is malformed')

  const pn = decodeURIComponentSafe(params.get('pn') || '')
  const mc = (params.get('mc') || '').trim()
  const am = (params.get('am') || '').trim()
  const mam = (params.get('mam') || '').trim()
  const cu = (params.get('cu') || 'INR').trim() || 'INR'
  const tn = decodeURIComponentSafe(params.get('tn') || '')
  const personal = isPersonalUpi(mc)

  return { pa, pn, mc, am, mam, cu, tn, personal, raw: urlText }
}

/** NPCI: amount as rupees with exactly 2 decimals — never commas, never paise integers. */
export function formatUpiAmount(am) {
  let cleaned = String(am ?? '').trim()
  // Do NOT strip "." — that would turn 10.50 into 1050 and blow past bank limits
  cleaned = cleaned.replace(/₹/g, '').replace(/\bRs\.?\b/gi, '').replace(/,/g, '').replace(/\s/g, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return ''
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100
  if (rounded < 0.01) return ''
  return rounded.toFixed(2)
}

export function validateUpiAmount(am, { mam, raw } = {}) {
  const amount = formatUpiAmount(am)
  if (!amount) return 'Enter a valid amount (at least ₹1)'
  const n = Number(amount)
  if (n < 1) return 'UPI amount must be at least ₹1'
  if (n > UPI_MAX_AMOUNT) {
    return `Amount is above ₹${UPI_MAX_AMOUNT.toLocaleString('en-IN')} (common UPI bank limit). Try a smaller amount.`
  }
  const maxFromQr = formatUpiAmount(mam || queryParam(raw, 'mam'))
  if (maxFromQr && n > Number(maxFromQr)) {
    return `This QR only allows up to ₹${maxFromQr}. Enter a smaller amount.`
  }
  return null
}

function sanitizeUpiNote(note) {
  return String(note || '')
    .replace(/[&?=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
}

function encodeUpiText(value) {
  return encodeURIComponent(value)
}

/**
 * Minimal clean upi://pay link — pa never encoded, amount always x.xx, no merchant junk.
 * Returns { link, pa, amount } so the UI can show exactly what will be paid.
 */
export function buildUpiPayLink({ pa, pn, am, cu = 'INR', tn }) {
  const cleanPa = normalizeVpa(pa)
  if (!cleanPa || !cleanPa.includes('@')) {
    throw new Error('Invalid UPI ID')
  }
  if (/%40/i.test(cleanPa)) {
    throw new Error('Invalid UPI ID encoding')
  }

  const amount = formatUpiAmount(am)
  if (!amount) throw new Error('Invalid amount')

  const parts = [
    `pa=${cleanPa}`,
    `am=${amount}`,
    `cu=INR`,
  ]
  const name = sanitizeUpiNote(pn)
  if (name) parts.push(`pn=${encodeUpiText(name)}`)
  const note = sanitizeUpiNote(tn)
  if (note) parts.push(`tn=${encodeUpiText(note)}`)

  const link = `upi://pay?${parts.join('&')}`
  assertSafeUpiLink(link, { pa: cleanPa, amount })
  return { link, pa: cleanPa, amount }
}

/**
 * Final safety gate — refuse to open GPay if the link is wrong.
 * Catches the bugs that cause "bank limit" / wrong payee / wrong amount.
 */
export function assertSafeUpiLink(link, { pa, amount }) {
  if (!link || typeof link !== 'string') throw new Error('Empty payment link')
  if (!/^upi:\/\/pay\?/i.test(link)) throw new Error('Payment link must start with upi://pay?')
  if (/%40/i.test(link)) throw new Error('Payment link wrongly encoded UPI ID — blocked')
  if ((link.match(/[?&]am=/gi) || []).length !== 1) throw new Error('Payment link amount is duplicated — blocked')
  if ((link.match(/[?&]pa=/gi) || []).length !== 1) throw new Error('Payment link UPI ID is duplicated — blocked')

  const linkPa = normalizeVpa(queryParam(link, 'pa'))
  const linkAm = formatUpiAmount(queryParam(link, 'am'))
  if (!linkPa || linkPa !== normalizeVpa(pa)) {
    throw new Error('Payment link UPI ID does not match — blocked')
  }
  if (!linkAm || linkAm !== formatUpiAmount(amount)) {
    throw new Error('Payment link amount does not match — blocked')
  }
  // No merchant signature / mode leftovers that confuse banks
  if (/[?&](sign|mode|orgid|mam)=/i.test(link)) {
    throw new Error('Payment link has unsafe merchant fields — blocked')
  }
  return true
}

/**
 * Open UPI app. On native, ONLY via UpiLauncher (never WebView href — that corrupts the link).
 */
export async function openUpiPayLink(link) {
  if (!link) throw new Error('Missing payment link')
  assertSafeUpiLink(link, {
    pa: queryParam(link, 'pa'),
    amount: queryParam(link, 'am'),
  })

  const { Capacitor, registerPlugin } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const UpiLauncher = registerPlugin('UpiLauncher')
    await UpiLauncher.open({ url: link })
    return
  }
  // Web only — still avoid <a href> re-serialization
  window.location.href = link
}

export function categoryIdByName(categories, categoryName) {
  if (!categoryName || !categories?.length) return ''
  const match = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())
  return match ? String(match.id) : ''
}

export function resolveCategoryId(categories, { pa, mc, personal, sharedCategoryName }) {
  if (sharedCategoryName) {
    const fromShared = categoryIdByName(categories, sharedCategoryName)
    if (fromShared) return fromShared
  }
  const remembered = recallMerchantCategoryId(pa)
  if (remembered && categories.some((c) => String(c.id) === String(remembered))) {
    return String(remembered)
  }
  if (!personal) {
    const fromMcc = categoryNameForMcc(mc)
    if (fromMcc) {
      const id = categoryIdByName(categories, fromMcc)
      if (id) return id
    }
    const other = categories.find((c) => c.name === 'Other')
    return other ? String(other.id) : ''
  }
  return ''
}
