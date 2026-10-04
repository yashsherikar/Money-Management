/**
 * Split a stored transaction description into a short headline (payee/merchant)
 * and secondary detail bits for the subtitle / meta line.
 *
 * Examples:
 *  "UPI SMS: SHOTDINE (7350…@ibl)" → title SHOTDINE, details [UPI SMS, vpa]
 *  "Split: UPI SMS: SHOTDINE (vpa) (my share ₹284 of ₹568)" → title SHOTDINE
 *  "SHOTDINE · 7350…@ibl" → title SHOTDINE
 *  "UPI SMS: uberindia@ybl" / no name but "uber" in text → title Uber
 */

import { brandFromTxnText } from './subscriptionBrands'

function stripUpiPrefix(s) {
  return String(s || '')
    .replace(/^(UPI(?:\s+SMS|\s+Merchant|\s+Request)?):\s*/i, '')
    .trim()
}

const WEAK_TITLES = new Set([
  'transaction',
  'payment',
  'upi payment',
  'upi',
  'transfer',
  'paid',
  'unknown',
  'merchant',
  'payee',
])

/** True when extracted headline is empty / generic / bare VPA / digits. */
export function isWeakTxnTitle(title) {
  const t = String(title || '').trim()
  if (!t) return true
  const lower = t.toLowerCase()
  if (WEAK_TITLES.has(lower)) return true
  if (t.length <= 2) return true
  if (/^[\d\s.*…xX\-]+$/.test(t)) return true
  // Bare VPA as the only "name"
  if (t.includes('@') && !/\s/.test(t)) return true
  return false
}

/** Title is a compacted brand code (UBERINDIA, SwiggyInstamart, etc.). */
function isBrandCodeTitle(title, brand) {
  if (!brand || !title) return false
  const t = String(title).toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!t) return false
  const id = String(brand.id || '').toLowerCase()
  const name = String(brand.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (id && (t === id || t.startsWith(id))) return true
  if (name && (t === name || t.startsWith(name))) return true
  return (brand.keywords || []).some((k) => {
    const key = String(k || '')
      .toLowerCase()
      .replace(/\\b/g, '')
      .replace(/[^a-z0-9]/g, '')
    return key.length >= 4 && (t === key || t.startsWith(key) || t.includes(key))
  })
}

export function formatTxnDisplay(description, categoryName = '') {
  let raw = String(description || '').trim()
  if (!raw) {
    return {
      title: categoryName || 'Transaction',
      details: [],
    }
  }

  const details = []
  let isSplit = false
  let shareText = ''

  const shareMatch = raw.match(/^(.*?)(\s*\(my share\s*₹[^)]+\))\s*$/i)
  if (shareMatch) {
    raw = shareMatch[1].trim()
    shareText = shareMatch[2].replace(/^\s*\(|\)\s*$/g, '').trim()
  }

  if (/^Split:\s*/i.test(raw)) {
    isSplit = true
    raw = raw.replace(/^Split:\s*/i, '').trim()
  }

  let sourceTag = ''
  const srcMatch = raw.match(/^(UPI(?:\s+SMS|\s+Merchant|\s+Request)?):\s*(.+)$/i)
  if (srcMatch) {
    sourceTag = srcMatch[1].trim()
    raw = srcMatch[2].trim()
  }

  let title = raw
  let vpa = ''

  // "NAME (someone@bank)"
  const paren = raw.match(/^(.+?)\s+\(([^)\s]+@[^)]+)\)\s*$/)
  if (paren) {
    title = paren[1].trim()
    vpa = paren[2].trim()
  } else if (raw.includes(' · ')) {
    const parts = raw.split(' · ').map((p) => p.trim()).filter(Boolean)
    title = parts[0] || title
    for (let i = 1; i < parts.length; i += 1) {
      const p = parts[i]
      if (/^UPI/i.test(p) && !sourceTag) sourceTag = p
      else if (p.includes('@') && !vpa) vpa = p
      else if (/^my share/i.test(p) && !shareText) shareText = p
      else if (/^Split$/i.test(p)) isSplit = true
      else if (p && p.toLowerCase() !== String(title).toLowerCase()) details.push(p)
    }
  } else if (/^[^)\s]+@[^)\s]+$/.test(raw)) {
    // Description is only a VPA
    title = ''
    vpa = raw
  }

  title = stripUpiPrefix(title)
  // If title still looks like "UPI SMS: SHOTDINE" after odd formats
  const again = title.match(/^(UPI(?:\s+SMS|\s+Merchant|\s+Request)?):\s*(.+)$/i)
  if (again) {
    if (!sourceTag) sourceTag = again[1]
    title = again[2].trim()
  }

  if (isSplit) details.push('Split')
  if (shareText) details.push(shareText)
  if (sourceTag) details.push(sourceTag)
  if (vpa) details.push(vpa)

  // No clear payee name (or brand code like UBERINDIA) → use known brand from description
  const brand = brandFromTxnText(description, title, vpa, raw)
  if (brand) {
    if (isWeakTxnTitle(title) || isBrandCodeTitle(title, brand)) {
      title = brand.name
    }
  }

  if (!title) title = categoryName || vpa || 'Transaction'

  return { title, details }
}

/** Prefill split-bill title with just the merchant/payee name. */
export function splitTitleFromTxnDescription(description, fallback = 'Split bill') {
  const { title } = formatTxnDisplay(description, fallback)
  return title || fallback
}

/**
 * Shared MoneyRow title / meta / brand — keep Home and Transactions identical.
 * @param {{ description?: string, categoryName?: string, accountName?: string, createdAt?: string|number|Date, type?: string, t?: (s:string)=>string, formatTime?: (v:any)=>string|null }} opts
 */
export function buildTxnRowDisplay({
  description = '',
  categoryName = '',
  accountName = '',
  createdAt,
  type,
  t = (s) => s,
  formatTime,
} = {}) {
  const desc = String(description || '')
  const isAutopay = /^Autopay:/i.test(desc)
  const isSavings = /^Savings/i.test(desc)
  const isTransfer = /^Transfer\s*:/i.test(desc)
  const brand = isTransfer ? null : brandFromTxnText(description, categoryName)
  const display = formatTxnDisplay(description, categoryName)
  const title = isTransfer || isAutopay || isSavings
    ? (description || categoryName || t('Transaction'))
    : display.title
  const timeLabel = typeof formatTime === 'function' ? formatTime(createdAt) : null
  const meta = [
    timeLabel,
    accountName,
    ...(isTransfer || isAutopay || isSavings ? [] : display.details),
    brand?.name && !new RegExp(`\\b${brand.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(desc)
      ? brand.name
      : null,
    isTransfer && t('Transfer · own accounts'),
    isAutopay && t('Autopay · SMS'),
    isSavings && t('Savings · SMS'),
    categoryName && description && !isAutopay && !isSavings && !isTransfer ? categoryName : null,
  ].filter(Boolean).join(' · ')

  return {
    title,
    meta: meta || undefined,
    brand,
    isIncome: type === 'INCOME',
    isAutopay,
    isSavings,
    isTransfer,
    iconText: brand ? undefined : `${description || ''} ${categoryName || ''}`.trim(),
  }
}
