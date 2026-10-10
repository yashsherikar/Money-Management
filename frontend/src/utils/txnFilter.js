import { buildTxnRowDisplay } from './txnDisplay.js'

/**
 * Client-side search + filters for the Transactions list (date range is applied by the API).
 * Search matches merchant, shown title (so "zepto" finds a KIRANAKART merchant), description,
 * category, account and amount; every typed word must match somewhere.
 */
export function filterTransactions(list, { q = '', categoryName = '', type = '', min = '', max = '' } = {}) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const lo = min === '' ? null : Number(min)
  const hi = max === '' ? null : Number(max)
  const cat = categoryName.trim().toLowerCase()

  return (list || []).filter((t) => {
    if (cat && String(t.categoryName || '').toLowerCase() !== cat) return false
    if (type && t.type !== type) return false
    const amount = Number(t.amount)
    if (lo != null && amount < lo) return false
    if (hi != null && amount > hi) return false
    if (!words.length) return true
    const row = buildTxnRowDisplay({
      description: t.description,
      merchantName: t.merchantName,
      categoryName: t.categoryName,
    })
    const hay = [
      row.title, row.brand?.name, t.merchantName, t.description,
      t.categoryName, t.accountName, String(t.amount),
    ].filter(Boolean).join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Spent / received totals for a (filtered) list. */
export function sumTransactions(list) {
  let spent = 0
  let received = 0
  for (const t of list || []) {
    if (t.type === 'INCOME') received += Number(t.amount) || 0
    else spent += Number(t.amount) || 0
  }
  return { spent, received }
}
