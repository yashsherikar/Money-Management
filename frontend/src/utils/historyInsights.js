/**
 * Build History page insights from /transactions when /history/insights
 * is unavailable (older backend / not redeployed yet).
 */
import { formatTxnDisplay } from './txnDisplay.js'
import { isTransferDescription } from './smsBankParse.js'

/** Normalize API peakSpendMonth "YYYY-MM" → "Mar 26" */
export function formatPeakSpendMonth(ym) {
  if (!ym) return null
  const s = String(ym).trim()
  if (/^\d{4}-\d{2}$/.test(s)) return monthLabel(s)
  return s
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function yearMonth(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthLabel(ym) {
  const [y, m] = String(ym).split('-')
  const mi = Number(m) - 1
  if (!y || mi < 0 || mi > 11) return ym
  return `${MONTH_SHORT[mi]} ${String(y).slice(2)}`
}

function parseTxnDate(t) {
  const raw = t?.txnDate || t?.date || ''
  if (!raw) return null
  const d = new Date(String(raw).length <= 10 ? `${raw}T12:00:00` : raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function merchantName(t) {
  const { title } = formatTxnDisplay(t?.description || '', t?.categoryName || '')
  const name = String(title || '').trim()
  if (!name || /^(upi payment|transfer|transaction)$/i.test(name)) return ''
  return name
}

/**
 * @param {Array} transactions
 * @param {number} monthsRequested  999 ≈ all history (cap 60)
 */
export function buildHistoryInsights(transactions, monthsRequested = 12) {
  const list = Array.isArray(transactions) ? transactions : []
  const today = new Date()
  let months = monthsRequested <= 0 ? 12 : Math.min(monthsRequested, 60)

  let endYm = yearMonth(today)
  let startCursor = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1)

  if (monthsRequested >= 999) {
    let earliest = null
    for (const t of list) {
      const d = parseTxnDate(t)
      if (d && (!earliest || d < earliest)) earliest = d
    }
    if (earliest) {
      startCursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
      months = Math.min(60, Math.max(1,
        (today.getFullYear() - startCursor.getFullYear()) * 12
        + (today.getMonth() - startCursor.getMonth()) + 1))
    }
  }

  const startYm = yearMonth(startCursor)
  const fromDate = new Date(startCursor.getFullYear(), startCursor.getMonth(), 1)
  const toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)

  const inRange = list.filter((t) => {
    const d = parseTxnDate(t)
    return d && d >= fromDate && d <= toDate
  })

  const monthlyMap = new Map()
  const cursor = new Date(fromDate)
  while (cursor <= toDate) {
    const ym = yearMonth(cursor)
    monthlyMap.set(ym, { month: ym, label: monthLabel(ym), income: 0, expense: 0, savings: 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  let totalIncome = 0
  let totalExpense = 0
  const catTotals = new Map()
  const merchantTotals = new Map()
  const merchantCounts = new Map()
  const merchantDisplay = new Map()

  for (const t of inRange) {
    const d = parseTxnDate(t)
    if (!d) continue
    if (isTransferDescription(t.description)) continue
    const ym = yearMonth(d)
    const bucket = monthlyMap.get(ym)
    const amt = Number(t.amount) || 0
    const type = String(t.type || '').toUpperCase()
    if (type === 'INCOME') {
      totalIncome += amt
      if (bucket) bucket.income += amt
    } else if (type === 'EXPENSE') {
      totalExpense += amt
      if (bucket) bucket.expense += amt
      const catId = t.categoryId ?? t.category?.id ?? null
      const catName = t.categoryName || t.category?.name || 'Uncategorized'
      const cKey = catId != null ? `id:${catId}` : `name:${catName}`
      const prev = catTotals.get(cKey) || { categoryId: catId, categoryName: catName, amount: 0 }
      prev.amount += amt
      catTotals.set(cKey, prev)

      const name = merchantName(t)
      if (name) {
        const key = name.toLowerCase()
        merchantTotals.set(key, (merchantTotals.get(key) || 0) + amt)
        merchantCounts.set(key, (merchantCounts.get(key) || 0) + 1)
        if (!merchantDisplay.has(key)) merchantDisplay.set(key, name)
      }
    }
  }

  for (const b of monthlyMap.values()) {
    b.savings = b.income - b.expense
  }

  const monthly = [...monthlyMap.values()]
  let peakSpendMonth = null
  let peakSpendAmount = 0
  for (const m of monthly) {
    if (m.expense > peakSpendAmount) {
      peakSpendAmount = m.expense
      peakSpendMonth = m.month
    }
  }

  const byCategory = [...catTotals.values()]
    .filter((c) => c.amount > 0)
    .map((c) => ({
      ...c,
      percent: totalExpense > 0 ? Math.round((c.amount * 1000) / totalExpense) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const topMerchants = [...merchantTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, amount]) => ({
      name: merchantDisplay.get(key) || key,
      amount,
      txnCount: merchantCounts.get(key) || 0,
      percent: totalExpense > 0 ? Math.round((amount * 1000) / totalExpense) / 10 : 0,
    }))

  return {
    from: `${startYm}-01`,
    to: yearMonth(toDate) + '-' + String(toDate.getDate()).padStart(2, '0'),
    months,
    totalIncome,
    totalExpense,
    totalSavings: totalIncome - totalExpense,
    peakSpendMonth: peakSpendMonth ? monthLabel(peakSpendMonth) : null,
    peakSpendAmount,
    topMerchant: topMerchants[0]?.name || null,
    topMerchantAmount: topMerchants[0]?.amount || 0,
    monthly,
    byCategory,
    topMerchants,
  }
}
