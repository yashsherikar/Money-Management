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
  const expense = categories.find((c) => String(c.name).toLowerCase() !== 'salary')
  return expense || categories[0]
}

/**
 * Store a list-friendly description: payee/merchant name first.
 * Extra bits (source + VPA) after " · " so the Transactions row can show
 * "SHOTDINE" as the headline and the rest in the subtitle.
 */
function buildDescription({ pn, pa, source, kind }) {
  const name = String(pn || '').trim()
  const vpa = String(pa || '').trim()
  const headline = name || vpa || 'UPI payment'
  const bits = [headline]
  let tag = 'UPI'
  if (source === 'sms') tag = 'UPI SMS'
  else if (source === 'manual') tag = 'UPI'
  else if (kind === 'merchant') tag = 'UPI Merchant'
  else if (kind === 'request') tag = 'UPI Request'
  bits.push(tag)
  if (name && vpa && name.toLowerCase() !== vpa.toLowerCase()) {
    bits.push(vpa)
  }
  return bits.join(' · ')
}

async function loadAccountsAndCategories() {
  const [a, c] = await Promise.all([
    client.get('/accounts'),
    client.get('/categories'),
  ])
  return { accounts: a.data || [], categories: c.data || [] }
}

/**
 * Always create an EXPENSE in Transactions for a confirmed UPI pay.
 * Category optional (Other / null) so SMS-confirmed pays never stay out of Transactions.
 */
export async function handleDetectedUpiPayment(parsed, { accounts, categories } = {}) {
  const pa = (parsed.pa || sessionStorage.getItem('mm_last_pay_pa') || '').toLowerCase().trim()
  const pn = parsed.payeeName || parsed.pn || sessionStorage.getItem('mm_last_pay_pn') || pa
  const amount = Number(parsed.amount)
  const source = parsed.source || 'upi'
  const kind = parsed.kind || (parsed.personal === false ? 'merchant' : 'p2p')
  if (!Number.isFinite(amount) || amount < 1) {
    return { logged: false, error: 'invalid_amount' }
  }

  const dedupeKey = `${pa}|${amount.toFixed(2)}|${Math.floor(Date.now() / 180_000)}`
  if (recentKeys.has(dedupeKey) && !parsed.forceLog) {
    return { logged: false, duplicate: true }
  }

  let accs = accounts
  let cats = categories
  if (!accs?.length || cats == null) {
    try {
      const loaded = await loadAccountsAndCategories()
      accs = accs?.length ? accs : loaded.accounts
      cats = cats?.length ? cats : loaded.categories
    } catch (err) {
      return {
        logged: false,
        error: err?.response?.data?.message || err?.message || 'load_failed',
        needsAccount: true,
      }
    }
  }

  const primary = accs?.find((a) => a.isPrimary) || accs?.[0]
  if (!primary) {
    savePendingCategoryPrompt({ pa, pn, amount, needsAccount: true, source, kind })
    return { logged: false, needsAccount: true, error: 'no_account' }
  }

  if (pa) upsertSavedPayee({ pa, pn })

  const known = pa ? findPayeeByPa(pa) : null
  let category = null
  let usedFallback = true

  if (known?.categoryId && cats?.some((c) => String(c.id) === String(known.categoryId))) {
    category = cats.find((c) => String(c.id) === String(known.categoryId))
    usedFallback = false
  } else {
    category = resolveOtherCategory(cats)
  }

  // If still no category, try create "Other"
  if (!category?.id) {
    try {
      const { data } = await client.post('/categories', { name: 'Other', essential: false })
      category = data
      cats = [...(cats || []), data]
      usedFallback = true
    } catch {
      // API allows null categoryId — still log the expense
      category = null
      usedFallback = true
    }
  }

  const description = buildDescription({ pn, pa, source, kind })
  try {
    const res = await client.post('/transactions', {
      accountId: Number(primary.id),
      categoryId: category?.id != null ? Number(category.id) : null,
      type: 'EXPENSE',
      amount,
      description,
      txnDate: new Date().toISOString().slice(0, 10),
    })
    const transactionId = res?.data?.id ?? res?.data?.transactionId ?? null
    recentKeys.add(dedupeKey)
    setTimeout(() => recentKeys.delete(dedupeKey), 190_000)

    window.dispatchEvent(new Event('mm-transactions-changed'))

    if (usedFallback && category?.id) {
      savePendingCategoryPrompt({
        pa,
        pn,
        amount,
        accountId: primary.id,
        transactionId,
        description,
        source,
        kind,
        refineOnly: true,
      })
      return {
        logged: true,
        transactionId,
        categoryName: category?.name || 'Other',
        needsCategory: true,
        refineOnly: true,
      }
    }

    return {
      logged: true,
      transactionId,
      categoryName: category?.name || known?.categoryName || 'Uncategorized',
      needsCategory: false,
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || 'save_failed'
    return { logged: false, error: msg }
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

/**
 * Push any SMS/manual-confirmed pays that never made it into Transactions.
 */
export async function syncUnloggedConfirmedPays() {
  const { listPendingP2pPays, updatePendingP2pPay } = await import('./pendingP2pPays.js')
  const need = listPendingP2pPays().filter(
    (p) => p.status === 'confirmed' && !p.transactionLogged,
  )
  if (!need.length) return []

  let accounts = []
  let categories = []
  try {
    const loaded = await loadAccountsAndCategories()
    accounts = loaded.accounts
    categories = loaded.categories
  } catch {
    return []
  }

  const results = []
  for (const item of need) {
    const logResult = await handleDetectedUpiPayment(
      {
        amount: item.amount,
        pa: item.pa,
        payeeName: item.pn,
        source: item.source || 'sms',
        kind: item.personal === false ? 'merchant' : 'p2p',
        forceLog: true,
      },
      { accounts, categories },
    )
    updatePendingP2pPay(item.id, {
      transactionLogged: !!logResult?.logged,
      transactionId: logResult?.transactionId || item.transactionId || null,
      logError: logResult?.logged
        ? null
        : (logResult?.error || (logResult?.duplicate ? 'duplicate' : 'log_failed')),
    })
    results.push({ id: item.id, ...logResult })
  }
  return results
}
