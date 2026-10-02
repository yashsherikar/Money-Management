/** Map UPI MCC (merchant category code) → default category name in this app. */
const MCC_TO_CATEGORY = {
  // Groceries / food retail
  '5411': 'Groceries',
  '5422': 'Groceries',
  '5441': 'Groceries',
  '5451': 'Groceries',
  '5462': 'Groceries',
  '5499': 'Groceries',
  // Restaurants / fast food
  '5812': 'Dining Out',
  '5813': 'Dining Out',
  '5814': 'Dining Out',
  // Transport / fuel
  '4111': 'Transport',
  '4121': 'Transport',
  '4131': 'Transport',
  '4789': 'Transport',
  '5541': 'Transport',
  '5542': 'Transport',
  '7523': 'Transport',
  // Healthcare
  '5122': 'Healthcare',
  '5912': 'Healthcare',
  '8011': 'Healthcare',
  '8021': 'Healthcare',
  '8041': 'Healthcare',
  '8050': 'Healthcare',
  '8062': 'Healthcare',
  '8099': 'Healthcare',
  // Utilities
  '4814': 'Utilities',
  '4899': 'Utilities',
  '4900': 'Utilities',
  // Shopping
  '5300': 'Shopping',
  '5311': 'Shopping',
  '5331': 'Shopping',
  '5399': 'Shopping',
  '5611': 'Shopping',
  '5621': 'Shopping',
  '5631': 'Shopping',
  '5641': 'Shopping',
  '5651': 'Shopping',
  '5661': 'Shopping',
  '5691': 'Shopping',
  '5699': 'Shopping',
  '5732': 'Shopping',
  '5733': 'Shopping',
  '5941': 'Shopping',
  '5942': 'Shopping',
  '5944': 'Shopping',
  '5945': 'Shopping',
  '5947': 'Shopping',
  '5977': 'Shopping',
  // Entertainment
  '7832': 'Entertainment',
  '7841': 'Entertainment',
  '7922': 'Entertainment',
  '7996': 'Entertainment',
  '7999': 'Entertainment',
  // Travel / lodging
  '3000': 'Travel',
  '4511': 'Travel',
  '4722': 'Travel',
  '7011': 'Travel',
  // Education
  '8211': 'Education',
  '8220': 'Education',
  '8241': 'Education',
  '8244': 'Education',
  '8299': 'Education',
  // Insurance
  '6300': 'Insurance',
  // Subscriptions / digital
  '4816': 'Subscriptions',
  '5734': 'Subscriptions',
  '5815': 'Subscriptions',
  '5816': 'Subscriptions',
  '5817': 'Subscriptions',
  '5818': 'Subscriptions',
}

const MERCHANT_CAT_KEY = 'upiMerchantCategoryByPa'

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
    // ignore quota / private mode
  }
}

/**
 * Parse a UPI QR payload into fields.
 * Accepts `upi://pay?...` or any string that contains that URL.
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
    // Fallback if URL ctor rejects the scheme on some engines
    const q = urlText.includes('?') ? urlText.slice(urlText.indexOf('?') + 1) : ''
    params = new URLSearchParams(q)
  }

  const pa = (params.get('pa') || '').trim()
  if (!pa) throw new Error('QR has no UPI ID (pa)')

  const pn = decodeURIComponent((params.get('pn') || '').replace(/\+/g, ' ')).trim()
  const mc = (params.get('mc') || '').trim()
  const am = (params.get('am') || '').trim()
  const cu = (params.get('cu') || 'INR').trim() || 'INR'
  const tn = decodeURIComponent((params.get('tn') || '').replace(/\+/g, ' ')).trim()
  const personal = isPersonalUpi(mc)

  return { pa, pn, mc, am, cu, tn, personal, raw: urlText }
}

/** NPCI expects amount with up to 2 decimal places, e.g. 10.00 — not "10" scientific noise. */
export function formatUpiAmount(am) {
  const n = Number(am)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n.toFixed(2)
}

/**
 * Build / patch a upi://pay link for GPay/PhonePe.
 * - Prefer mutating the original QR (`raw`) so merchant fields (sign, mode, orgid…) stay intact.
 * - Never URL-encode the VPA (`pa`) — `%40` for `@` breaks some GPay flows.
 * - Amount always `x.xx`.
 */
export function buildUpiPayLink({ pa, pn, am, cu = 'INR', mc, tn, raw }) {
  const amount = formatUpiAmount(am)
  const note = (tn || '').trim().slice(0, 50)

  // Keep the scanned QR byte-for-byte except amount/currency — merchant signed QRs
  // fail in GPay if we rebuild and drop `sign` / over-encode `pa`.
  if (raw && /^upi:\/\//i.test(raw)) {
    let out = raw
    if (amount) {
      if (/[?&]am=/i.test(out)) {
        out = out.replace(/([?&])am=[^&]*/i, `$1am=${amount}`)
      } else {
        out += (out.includes('?') ? '&' : '?') + `am=${amount}`
      }
    }
    if (!/[?&]cu=/i.test(out)) {
      out += (out.includes('?') ? '&' : '?') + `cu=${cu || 'INR'}`
    }
    return out
  }

  // Fresh P2P / rebuilt link — encode name & note only; leave VPA raw
  const parts = [`pa=${String(pa || '').trim()}`, `cu=${cu || 'INR'}`]
  if (pn) parts.push(`pn=${encodeURIComponent(String(pn).trim())}`)
  if (amount) parts.push(`am=${amount}`)
  if (mc && !isPersonalUpi(mc)) parts.push(`mc=${String(mc).trim()}`)
  if (note) parts.push(`tn=${encodeURIComponent(note)}`)
  return `upi://pay?${parts.join('&')}`
}

/** Open UPI chooser (GPay etc.) without mangling the scheme. */
export function openUpiPayLink(link) {
  if (!link) return
  const a = document.createElement('a')
  a.href = link
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Match a category name (from MCC or shared DB hint) to the user's category id. */
export function categoryIdByName(categories, categoryName) {
  if (!categoryName || !categories?.length) return ''
  const match = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())
  return match ? String(match.id) : ''
}

/**
 * Resolve category: shared DB hint name → MCC map (merchants only) → local cache.
 * Personal UPI with no hint leaves category empty so the user picks one.
 */
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
