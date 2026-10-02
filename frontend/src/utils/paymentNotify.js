import { Capacitor, registerPlugin } from '@capacitor/core'
import { parseUpiPaymentNotification } from './upiNotifyParse.js'
import {
  findPayeeByPa,
  savePendingCategoryPrompt,
  upsertSavedPayee,
} from './savedPayees.js'
import client from '../api/client'

const PaymentNotify = registerPlugin('PaymentNotify')

export function isPaymentNotifySupported() {
  return Capacitor.isNativePlatform()
}

export async function isPaymentNotifyEnabled() {
  if (!isPaymentNotifySupported()) return false
  try {
    const { enabled } = await PaymentNotify.isEnabled()
    return !!enabled
  } catch {
    return false
  }
}

export async function openPaymentNotifySettings() {
  if (!isPaymentNotifySupported()) return
  await PaymentNotify.openSettings()
}

export async function getLastPaymentNotifyRaw() {
  if (!isPaymentNotifySupported()) return null
  try {
    return await PaymentNotify.getLastRaw()
  } catch {
    return null
  }
}

/**
 * Listen for UPI payment notifications from the native listener.
 * Returns an unsubscribe function.
 */
export function listenForUpiPaymentNotifications(onPayment) {
  if (!isPaymentNotifySupported()) return () => {}

  let handle = null
  PaymentNotify.addListener('upiPaymentNotify', async (event) => {
    const parsed = parseUpiPaymentNotification(event)
      || parseUpiPaymentNotification({
        title: event?.title,
        text: event?.text,
        packageName: event?.packageName,
      })
    if (!parsed) return

    // Prefer VPA from our last Pay action if notification omitted it
    const lastPa = sessionStorage.getItem('mm_last_pay_pa') || ''
    const lastPn = sessionStorage.getItem('mm_last_pay_pn') || ''
    if (!parsed.pa && lastPa) parsed.pa = lastPa
    if (!parsed.payeeName && lastPn) parsed.payeeName = lastPn

    onPayment?.(parsed)
  }).then((h) => { handle = h })

  return () => {
    handle?.remove?.()
  }
}

const recentKeys = new Set()

/** Auto-log expense when category known; otherwise queue category prompt. */
export async function handleDetectedUpiPayment(parsed, { accounts, categories }) {
  const pa = (parsed.pa || sessionStorage.getItem('mm_last_pay_pa') || '').toLowerCase()
  const pn = parsed.payeeName || sessionStorage.getItem('mm_last_pay_pn') || pa
  const amount = parsed.amount
  if (!amount) return { logged: false }

  const dedupeKey = `${pa}|${amount}|${Math.floor(Date.now() / 120_000)}`
  if (recentKeys.has(dedupeKey)) return { logged: false, duplicate: true }
  recentKeys.add(dedupeKey)
  setTimeout(() => recentKeys.delete(dedupeKey), 130_000)

  if (pa) {
    upsertSavedPayee({ pa, pn })
  }

  const known = pa ? findPayeeByPa(pa) : null
  const primary = accounts?.find((a) => a.isPrimary) || accounts?.[0]
  if (!primary) {
    savePendingCategoryPrompt({ pa, pn, amount, needsAccount: true })
    return { logged: false, needsCategory: true }
  }

  if (known?.categoryId && categories?.some((c) => String(c.id) === String(known.categoryId))) {
    await client.post('/transactions', {
      accountId: Number(primary.id),
      categoryId: Number(known.categoryId),
      type: 'EXPENSE',
      amount: Number(amount),
      description: pn || pa || 'UPI payment',
      txnDate: new Date().toISOString().slice(0, 10),
    })
    window.dispatchEvent(new Event('mm-transactions-changed'))
    return { logged: true, categoryName: known.categoryName }
  }

  savePendingCategoryPrompt({ pa, pn, amount, accountId: primary.id })
  return { logged: false, needsCategory: true }
}

export function rememberLastPayAttempt({ pa, pn, amount }) {
  try {
    sessionStorage.setItem('mm_last_pay_pa', String(pa || ''))
    sessionStorage.setItem('mm_last_pay_pn', String(pn || ''))
    sessionStorage.setItem('mm_last_pay_am', String(amount || ''))
    sessionStorage.setItem('mm_last_pay_at', String(Date.now()))
  } catch { /* ignore */ }
}
