import { Capacitor, registerPlugin } from '@capacitor/core'
import client from '../api/client'
import { localDateYmd } from './localDate.js'

const SpendWidget = registerPlugin('SpendWidget')

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`

/** Today's + this month's spend (expenses, not self-transfers). */
export function spendTotals(list, today = localDateYmd()) {
  let day = 0
  let month = 0
  for (const t of list || []) {
    if (t.type !== 'EXPENSE' || /^Transfer\s*:/i.test(t.description || '')) continue
    const amt = Number(t.amount) || 0
    month += amt
    if (t.txnDate === today) day += amt
  }
  return { day, month }
}

async function refresh() {
  if (!localStorage.getItem('token')) return
  const { data } = await client.get('/transactions') // API default = current month
  const { day, month } = spendTotals(Array.isArray(data) ? data : [])
  const now = new Date()
  await SpendWidget.update({
    today: inr(day),
    month: inr(month),
    updated: `Updated ${now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`,
  })
}

/** Keeps the home-screen widget current: on start, on resume, and after any transaction change. */
export function startSpendWidgetSync() {
  if (Capacitor.getPlatform() !== 'android') return undefined
  let timer = null
  const soon = () => {
    clearTimeout(timer)
    timer = setTimeout(() => refresh().catch(() => {}), 1500)
  }
  const onVisible = () => { if (document.visibilityState === 'visible') soon() }
  // Any successful add/edit/delete of a transaction, from any screen
  const interceptor = client.interceptors.response.use((res) => {
    const { method, url } = res.config || {}
    if (method !== 'get' && /\/transactions(\/|$|\?)/.test(url || '')) soon()
    return res
  })
  soon()
  window.addEventListener('mm-transactions-changed', soon)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    client.interceptors.response.eject(interceptor)
    clearTimeout(timer)
    window.removeEventListener('mm-transactions-changed', soon)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
