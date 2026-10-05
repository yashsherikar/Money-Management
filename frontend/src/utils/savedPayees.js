/** Local saved UPI payees + category memory (device-only). */

const PAYEES_KEY = 'mm_saved_payees'
const PENDING_CAT_KEY = 'mm_pending_pay_category'

export function listSavedPayees() {
  try {
    const raw = JSON.parse(localStorage.getItem(PAYEES_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function upsertSavedPayee({ pa, pn, categoryId = null, categoryName = null }) {
  const vpa = String(pa || '').trim().toLowerCase()
  if (!vpa || !vpa.includes('@')) return
  const list = listSavedPayees().filter((p) => p.pa !== vpa)
  list.unshift({
    pa: vpa,
    pn: String(pn || '').trim(),
    categoryId: categoryId ? String(categoryId) : null,
    categoryName: categoryName || null,
    updatedAt: Date.now(),
  })
  localStorage.setItem(PAYEES_KEY, JSON.stringify(list.slice(0, 50)))
}

export function findPayeeByPa(pa) {
  const vpa = String(pa || '').trim().toLowerCase()
  return listSavedPayees().find((p) => p.pa === vpa) || null
}

export function rememberPayeeCategory(pa, categoryId, categoryName) {
  const existing = findPayeeByPa(pa) || { pa, pn: '' }
  upsertSavedPayee({
    ...existing,
    pa,
    categoryId,
    categoryName,
  })
}

export function savePendingCategoryPrompt(payload) {
  try {
    localStorage.setItem(PENDING_CAT_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }))
  } catch { /* ignore */ }
}

export function readPendingCategoryPrompt() {
  try {
    const raw = localStorage.getItem(PENDING_CAT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.savedAt || Date.now() - data.savedAt > 24 * 60 * 60_000) {
      localStorage.removeItem(PENDING_CAT_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function clearPendingCategoryPrompt() {
  localStorage.removeItem(PENDING_CAT_KEY)
}

/** Remembered category by merchant NAME (device-only) — for bank-SMS debits, which
 *  only ever carry a merchant name ("PAYAL SUPER MAR"), never a UPI ID/VPA, so the
 *  pa-keyed memory above can't apply to them. */
const MERCHANT_CAT_KEY = 'mm_merchant_category'

function normalizeMerchantName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function findCategoryByMerchantName(name) {
  const key = normalizeMerchantName(name)
  if (!key) return null
  try {
    const map = JSON.parse(localStorage.getItem(MERCHANT_CAT_KEY) || '{}')
    return map[key] || null
  } catch {
    return null
  }
}

export function rememberMerchantCategory(name, categoryId, categoryName) {
  const key = normalizeMerchantName(name)
  if (!key || !categoryId) return
  try {
    const map = JSON.parse(localStorage.getItem(MERCHANT_CAT_KEY) || '{}')
    map[key] = { categoryId: String(categoryId), categoryName: categoryName || null, updatedAt: Date.now() }
    localStorage.setItem(MERCHANT_CAT_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}
