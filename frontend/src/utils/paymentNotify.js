import { Capacitor, registerPlugin } from '@capacitor/core'
import { parseUpiPaymentNotification } from './upiNotifyParse.js'
import {
  findPayeeByPa,
  savePendingCategoryPrompt,
  upsertSavedPayee,
  rememberPayeeCategory,
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

function resolveOtherCategory(categories) {
  if (!categories?.length) return null
  const other = categories.find((c) => String(c.name).toLowerCase() === 'other')
  if (other) return other
  // Prefer non-income categories
  const expense = categories.find((c) => String(c.name).toLowerCase() !== 'salary')
  return expense || categories[0]
}

function buildDescription({ pn, pa, source }) {
  const name = String(pn || '').trim()
  const vpa = String(pa || '').trim()
  const base = name || vpa || 'UPI payment'
  const tag = source === 'sms' ? 'UPI SMS' : source === 'manual' ? 'UPI' : 'UPI'
  if (name && vpa && name.toLowerCase() !== vpa.toLowerCase()) {
    return `${tag}: ${name} (${vpa})`
  }
  return `${tag}: ${base}`
}

/**
 * Always create an EXPENSE transaction for a confirmed UPI pay.
 * - Known payee category → use it
 * - Else → "Other" (still logs), then optional category refine prompt
 */
export async function handleDetectedUpiPayment(parsed, { accounts, categories }) {
  const pa = (parsed.pa || sessionStorage.getItem('mm_last_pay_pa') || '').toLowerCase().trim()
  const pn = parsed.payeeName || sessionStorage.getItem('mm_last_pay_pn') || pa
  const amount = Number(parsed.amount)
  const source = parsed.source || 'upi'
  if (!Number.isFinite(amount) || amount < 1) return { logged: false }

  const dedupeKey = `${pa}|${amount.toFixed(2)}|${Math.floor(Date.now() / 120_000)}`
  if (recentKeys.has(dedupeKey)) return { logged: false, duplicate: true }
  recentKeys.add(dedupeKey)
  setTimeout(() => recentKeys.delete(dedupeKey), 130_000)

  if (pa) upsertSavedPayee({ pa, pn })

  const primary = accounts?.find((a) => a.isPrimary) || accounts?.[0]
  if (!primary) {
    savePendingCategoryPrompt({ pa, pn, amount, needsAccount: true, source })
    return { logged: false, needsAccount: true, needsCategory: true }
  }

  const known = pa ? findPayeeByPa(pa) : null
  let category = null
  let usedFallback = false

  if (known?.categoryId && categories?.some((c) => String(c.id) === String(known.categoryId))) {
    category = categories.find((c) => String(c.id) === String(known.categoryId))
  } else {
    category = resolveOtherCategory(categories)
    usedFallback = true
  }

  if (!category?.id) {
    savePendingCategoryPrompt({ pa, pn, amount, accountId: primary.id, source })
    return { logged: false, needsCategory: true }
  }

  const description = buildDescription({ pn, pa, source })
  const res = await client.post('/transactions', {
    accountId: Number(primary.id),
    categoryId: Number(category.id),
    type: 'EXPENSE',
    amount,
    description,
    txnDate: new Date().toISOString().slice(0, 10),
  })
  const transactionId = res?.data?.id ?? res?.data?.transactionId ?? null

  window.dispatchEvent(new Event('mm-transactions-changed'))

  // New payee / fallback category → ask to refine (txn already saved)
  if (usedFallback) {
    savePendingCategoryPrompt({
      pa,
      pn,
      amount,
      accountId: primary.id,
      transactionId,
      description,
      source,
      refineOnly: true,
    })
    return {
      logged: true,
      transactionId,
      categoryName: category.name,
      needsCategory: true,
      refineOnly: true,
    }
  }

  return {
    logged: true,
    transactionId,
    categoryName: category.name || known?.categoryName,
    needsCategory: false,
  }
}

/** Update category on an already-logged transaction (after refine prompt). */
export async function updateLoggedUpiCategory({ transactionId, accountId, amount, description, pa, pn, categoryId, categories }) {
  const cat = categories?.find((c) => String(c.id) === String(categoryId))
  if (!cat) throw new Error('Category missing')

  if (transactionId) {
    await client.put(`/transactions/${transactionId}`, {
      accountId: Number(accountId),
      categoryId: Number(categoryId),
      type: 'EXPENSE',
      amount: Number(amount),
      description: description || buildDescription({ pn, pa, source: 'upi' }),
      txnDate: new Date().toISOString().slice(0, 10),
    })
  } else {
    await client.post('/transactions', {
      accountId: Number(accountId),
      categoryId: Number(categoryId),
      type: 'EXPENSE',
      amount: Number(amount),
      description: description || buildDescription({ pn, pa, source: 'upi' }),
      txnDate: new Date().toISOString().slice(0, 10),
    })
  }
  if (pa) rememberPayeeCategory(pa, categoryId, cat.name)
  window.dispatchEvent(new Event('mm-transactions-changed'))
  return { categoryName: cat.name }
}

export function rememberLastPayAttempt({ pa, pn, amount }) {
  try {
    sessionStorage.setItem('mm_last_pay_pa', String(pa || ''))
    sessionStorage.setItem('mm_last_pay_pn', String(pn || ''))
    sessionStorage.setItem('mm_last_pay_am', String(amount || ''))
    sessionStorage.setItem('mm_last_pay_at', String(Date.now()))
  } catch { /* ignore */ }
}
