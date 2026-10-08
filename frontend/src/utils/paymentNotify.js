import { Capacitor, registerPlugin } from '@capacitor/core'
import { parseUpiPaymentNotification } from './upiNotifyParse.js'
import {
  findPayeeByPa,
  savePendingCategoryPrompt,
  upsertSavedPayee,
  rememberPayeeCategory,
} from './savedPayees.js'
import client from '../api/client'
import { localDateYmd } from './localDate.js'

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

  const sub = PaymentNotify.addListener('upiPaymentNotify', async (event) => {
    const parsed = parseUpiPaymentNotification(event)
      || parseUpiPaymentNotification({
        title: event?.title,
        text: event?.text,
        packageName: event?.packageName,
      })
    if (!parsed) return

    const lastPa = sessionStorage.getItem('mm_last_pay_pa') || ''
    const lastPn = sessionStorage.getItem('mm_last_pay_pn') || ''
    const lastCat = sessionStorage.getItem('mm_last_pay_cat') || ''
    const lastDesc = sessionStorage.getItem('mm_last_pay_desc') || ''
    if (!parsed.pa && lastPa) parsed.pa = lastPa
    if (!parsed.payeeName && lastPn) parsed.payeeName = lastPn
    if (!parsed.categoryId && lastCat) parsed.categoryId = lastCat
    if (!parsed.description && lastDesc) parsed.description = lastDesc

    // Merge category/description from waiting pending pay if still open
    try {
      const { waitingP2pPays } = await import('./pendingP2pPays.js')
      const { pickBestPendingMatch } = await import('./smsPayParse.js')
      const match = pickBestPendingMatch({
        amount: parsed.amount,
        pa: parsed.pa,
        payeeName: parsed.payeeName,
        date: Date.now(),
      }, waitingP2pPays())
      if (match) {
        if (!parsed.categoryId && match.categoryId) parsed.categoryId = match.categoryId
        if (!parsed.description && match.description) parsed.description = match.description
        if (!parsed.pa && match.pa) parsed.pa = match.pa
        if (!parsed.payeeName && match.pn) parsed.payeeName = match.pn
        parsed._pendingId = match.id
      }
    } catch { /* ignore */ }

    onPayment?.(parsed)
  })

  return () => {
    Promise.resolve(sub).then((h) => h?.remove?.()).catch(() => {})
  }
}

/** After notify/manual log — close matching waiting pending so SMS won't double-post. */
export async function closePendingAfterUpiLog(parsed, logResult) {
  try {
    const {
      waitingP2pPays,
      markPendingP2pConfirmed,
      updatePendingP2pPay,
      getPendingP2pPay,
    } = await import('./pendingP2pPays.js')
    const { pickBestPendingMatch } = await import('./smsPayParse.js')

    let match = null
    if (parsed?._pendingId) {
      match = getPendingP2pPay(parsed._pendingId)
      if (match && match.status !== 'waiting_sms' && match.status !== 'pending') match = null
    }
    if (!match) {
      match = pickBestPendingMatch({
        amount: parsed?.amount,
        pa: parsed?.pa,
        payeeName: parsed?.payeeName || parsed?.pn,
        date: Date.now(),
      }, waitingP2pPays())
    }
    if (!match) return null

    markPendingP2pConfirmed(match.id, {
      source: parsed?.source || 'notify',
      transactionLogged: !!logResult?.logged,
      transactionId: logResult?.transactionId || null,
    })
    if (logResult?.logged) {
      updatePendingP2pPay(match.id, {
        transactionLogged: true,
        transactionId: logResult.transactionId || null,
        logError: null,
      })
    }
    return match
  } catch {
    return null
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
 * Human description only — never put UPI VPA here (that goes in paymentId).
 */
function buildDescription({ pn, note, source, kind }) {
  const name = String(pn || '').trim()
  const extra = String(note || '').trim()
  if (extra && name && extra.toLowerCase() !== name.toLowerCase()) {
    return `${name} · ${extra}`.slice(0, 220)
  }
  if (extra) return extra.slice(0, 220)
  if (name) return name.slice(0, 220)
  if (kind === 'merchant') return 'Merchant payment'
  if (source === 'sms') return 'UPI payment'
  return 'UPI payment'
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
  // Always honor in-session dedupe — forceLog must not create double expenses
  if (recentKeys.has(dedupeKey)) {
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

  // Pre-selected on QR/Pay screen (or pending pay) — never ask again after pay
  const rawPreCatId = parsed.categoryId != null ? String(parsed.categoryId) : ''
  const validPreCat = !!(rawPreCatId && cats?.some((c) => String(c.id) === rawPreCatId))
  if (validPreCat) {
    category = cats.find((c) => String(c.id) === rawPreCatId)
    usedFallback = false
    if (pa) rememberPayeeCategory(pa, category.id, category.name)
  } else if (known?.categoryId && cats?.some((c) => String(c.id) === String(known.categoryId))) {
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

  const note = String(parsed.description || '').trim()
  // Description = human text only; Payment ID (UPI VPA) is a separate column
  const description = buildDescription({
    pn,
    note: note && note.toLowerCase() !== String(pn || '').toLowerCase() ? note : '',
    source,
    kind,
  })
  const paymentId = pa || null
  try {
    const res = await client.post('/transactions', {
      accountId: Number(primary.id),
      categoryId: category?.id != null ? Number(category.id) : null,
      type: 'EXPENSE',
      amount,
      description,
      paymentId,
      merchantName: pn || null,
      txnDate: localDateYmd(),
    })
    const transactionId = res?.data?.id ?? res?.data?.transactionId ?? null
    recentKeys.add(dedupeKey)
    setTimeout(() => recentKeys.delete(dedupeKey), 190_000)

    // Link QR/UPI pay → subscription / recurring due (unique amount or name match)
    let dueConfirmed = null
    try {
      const { tryConfirmMatchingDues } = await import('./matchDueSms.js')
      dueConfirmed = await tryConfirmMatchingDues({
        amount,
        merchant: pn,
        raw: `${pn || ''} ${pa || ''} ${description || ''}`,
        allowUniqueAmount: true,
      })
    } catch { /* ignore */ }

    window.dispatchEvent(new Event('mm-transactions-changed'))

    // Skip post-pay category prompt only when a valid Pay-screen category was used
    if (usedFallback && category?.id && !validPreCat) {
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
        txnDate: localDateYmd(),
      })
      return {
        logged: true,
        transactionId,
        categoryName: category?.name || 'Other',
        needsCategory: true,
        refineOnly: true,
        dueConfirmed,
      }
    }

    return {
      logged: true,
      transactionId,
      categoryName: category?.name || known?.categoryName || 'Uncategorized',
      needsCategory: false,
      dueConfirmed,
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || 'save_failed'
    return { logged: false, error: msg }
  }
}

/** Update category on an already-logged transaction (after refine prompt). */
export async function updateLoggedUpiCategory({
  transactionId, accountId, amount, description, pa, pn, categoryId, categories, txnDate,
} = {}) {
  const cat = categories?.find((c) => String(c.id) === String(categoryId))
  if (!cat) throw new Error('Category missing')
  if (accountId == null || accountId === '') throw new Error('Account missing')
  const date = txnDate || localDateYmd()
  const desc = description || buildDescription({ pn, note: description, source: 'upi' })
  const body = {
    accountId: Number(accountId),
    categoryId: Number(categoryId),
    type: 'EXPENSE',
    amount: Number(amount),
    description: desc,
    // null preserves existing Payment ID when refining category only
    paymentId: pa != null && String(pa).trim() !== '' ? String(pa).trim() : null,
    txnDate: date,
  }
  if (transactionId) {
    const { data: saved } = await client.put(`/transactions/${transactionId}`, body)
    if (pa) rememberPayeeCategory(pa, categoryId, cat.name)
    window.dispatchEvent(new Event('mm-transactions-changed'))
    return { categoryName: saved?.categoryName || cat.name }
  }
  await client.post('/transactions', body)
  if (pa) rememberPayeeCategory(pa, categoryId, cat.name)
  window.dispatchEvent(new Event('mm-transactions-changed'))
  return { categoryName: cat.name }
}

export function rememberLastPayAttempt({ pa, pn, amount, categoryId = null, description = null } = {}) {
  try {
    sessionStorage.setItem('mm_last_pay_pa', String(pa || ''))
    sessionStorage.setItem('mm_last_pay_pn', String(pn || ''))
    sessionStorage.setItem('mm_last_pay_am', String(amount || ''))
    sessionStorage.setItem('mm_last_pay_at', String(Date.now()))
    sessionStorage.setItem('mm_last_pay_cat', categoryId != null ? String(categoryId) : '')
    sessionStorage.setItem('mm_last_pay_desc', description ? String(description).slice(0, 220) : '')
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
        categoryId: item.categoryId || null,
        description: item.description || null,
        personal: item.personal,
      },
      { accounts, categories },
    )
    // duplicate ⇒ already logged this session — treat as success so we don't retry forever
    const ok = !!logResult?.logged || !!logResult?.duplicate
    updatePendingP2pPay(item.id, {
      transactionLogged: ok,
      transactionId: logResult?.transactionId || item.transactionId || null,
      logError: ok
        ? null
        : (logResult?.error || 'log_failed'),
    })
    results.push({ id: item.id, ...logResult })
  }
  return results
}
