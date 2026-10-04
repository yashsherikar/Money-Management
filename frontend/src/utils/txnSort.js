import { localDateYmd } from './localDate.js'

/** Newest day first; within a day, newest createdAt / id. */
export function sortTransactionsByTime(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const da = String(a?.txnDate || '')
    const db = String(b?.txnDate || '')
    if (da !== db) return db.localeCompare(da)
    const ta = Date.parse(a?.createdAt || '') || 0
    const tb = Date.parse(b?.createdAt || '') || 0
    if (tb !== ta) return tb - ta
    return Number(b?.id || 0) - Number(a?.id || 0)
  })
}

/** Group sorted txns into [{ date, items }] for day headers. */
export function groupTransactionsByDate(list) {
  const sorted = sortTransactionsByTime(list)
  const groups = []
  let cur = null
  for (const txn of sorted) {
    const date = String(txn?.txnDate || '')
    if (!cur || cur.date !== date) {
      cur = { date, items: [] }
      groups.push(cur)
    }
    cur.items.push(txn)
  }
  return groups
}

export function formatTxnTime(createdAt) {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

/** "Today" / "Yesterday" / "4 Oct 2026" */
export function formatTxnDayLabel(ymd, t = (s) => s) {
  if (!ymd) return ''
  const today = localDateYmd()
  const yest = localDateYmd(Date.now() - 86400000)
  if (ymd === today) return t('Today')
  if (ymd === yest) return t('Yesterday')
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
