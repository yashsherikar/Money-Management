import { Capacitor, registerPlugin } from '@capacitor/core'
import { parseBankPaymentSms, pickBestPendingMatch } from './smsPayParse.js'
import {
  waitingP2pPays,
  markPendingP2pConfirmed,
  listPendingP2pPays,
  updatePendingP2pPay,
  getPendingP2pPay,
} from './pendingP2pPays.js'
import { handleDetectedUpiPayment } from './paymentNotify.js'
import { processAutopaySms, markSmsConsumedByPayConfirm } from './autopayDetect.js'
import { processAutopayStopSms, isAutopayStopSms } from './autopayStopDetect.js'
import { shouldIgnoreMoneySms } from './smsScamFilter.js'
import {
  ensureSmsListenFrom,
  getSmsListenFrom,
  markSmsListenFromNow,
  isSmsFromPresent,
} from './smsListenGate.js'
import client from '../api/client'
import { isLoggedIn } from './userStorage.js'

const SmsReader = registerPlugin('SmsReader')

let started = false
let listenerHandle = null
let watchTimer = null
const processedKeys = new Set()

function smsKey(msg, parsed) {
  const body = (msg?.body || msg?.text || parsed?.raw || '').slice(0, 120)
  const date = msg?.date || parsed?.date || 0
  const amt = parsed?.amount || ''
  return `${date}|${amt}|${body}`
}

function rememberProcessed(key) {
  processedKeys.add(key)
  if (processedKeys.size > 200) {
    const first = processedKeys.values().next().value
    processedKeys.delete(first)
  }
}

export function isSmsPaySupported() {
  return Capacitor.isNativePlatform()
}

export async function checkSmsPermission() {
  if (!isSmsPaySupported()) return { granted: false, sms: 'unavailable' }
  try {
    const ret = await SmsReader.checkPermissions()
    const granted = !!(ret?.granted || ret?.sms === 'granted' || ret?.sms === 'GRANTED')
    return { ...ret, granted }
  } catch {
    return { granted: false, sms: 'denied' }
  }
}

export async function requestSmsPermission() {
  if (!isSmsPaySupported()) return { granted: false }
  try {
    const ret = await SmsReader.requestPermissions()
    const granted = !!(ret?.granted || ret?.sms === 'granted' || ret?.sms === 'GRANTED')
    if (granted) {
      // Arm from this moment — no past SMS
      markSmsListenFromNow()
      await SmsReader.startWatch({ sinceMs: getSmsListenFrom() }).catch(() => {})
      // Only live SMS queued while granting (not inbox history)
      drainLiveSmsQueue().catch(() => {})
    }
    return { ...ret, granted }
  } catch {
    return { granted: false }
  }
}

/**
 * Process one LIVE SMS only: ignore past, ads, scam, spam, non debit/credit.
 */
export async function processIncomingSms(msg, { accounts, categories } = {}) {
  if (!isLoggedIn()) return null

  const body = msg?.body || msg?.text || ''
  const address = msg?.address || ''

  // Never process old inbox / history SMS
  if (!isSmsFromPresent(msg)) return null

  // Autopay cancelled / failed → pause subscription (not a debit/credit txn)
  try {
    if (isAutopayStopSms({ body, address })) {
      const stopped = await processAutopayStopSms(msg)
      if (stopped?.paused) return { autopayStopped: stopped }
    }
  } catch { /* ignore */ }

  // Ads / scam / spam / no real debit or credit → ignore
  if (shouldIgnoreMoneySms({ body, address })) return null

  const parsed = parseBankPaymentSms({
    body,
    address,
    date: msg?.date || Date.now(),
  })

  if (parsed) {
    const key = smsKey(msg, parsed)
    // Same SMS already confirmed this session — never fall through to category popup
    if (processedKeys.has(key)) {
      markSmsConsumedByPayConfirm({
        body,
        address,
        amount: parsed.amount,
        date: msg?.date || parsed.date || Date.now(),
      })
      return { alreadyHandled: true }
    }

    const waiting = waitingP2pPays()
    if (waiting.length) {
      const match = pickBestPendingMatch(parsed, waiting)
      if (match) {
        return confirmPendingFromSms(msg, parsed, match, key, { accounts, categories })
      }
    }

    // Pending already confirmed (app reopen / re-drain) — still suppress forgot-expense
    const confirmed = listPendingP2pPays().find((p) => {
      if (p.status !== 'confirmed') return false
      if (Math.abs(Number(p.amount) - Number(parsed.amount)) > 0.011) return false
      const created = Number(p.createdAt) || 0
      const confirmedAt = Number(p.confirmedAt) || created
      const smsDate = Number(msg?.date || parsed.date) || Date.now()
      if (smsDate < created - 2 * 60_000) return false
      if (smsDate > confirmedAt + 24 * 60 * 60_000) return false
      return true
    })
    if (confirmed) {
      rememberProcessed(key)
      markSmsConsumedByPayConfirm({
        body,
        address,
        amount: confirmed.amount,
        date: msg?.date || parsed.date || Date.now(),
      })
      return { alreadyConfirmed: true, pendingId: confirmed.id }
    }
  }

  try {
    const ap = await processAutopaySms(msg, { accounts, categories })
    if (ap) return { autopay: ap }
  } catch { /* ignore */ }

  return null
}

async function confirmPendingFromSms(msg, parsed, match, key, { accounts, categories } = {}) {
  rememberProcessed(key)
  markPendingP2pConfirmed(match.id, {
    smsRaw: parsed.raw,
    source: 'sms',
  })

  // Do not show "forgot expense / pick category" for this same bank SMS
  markSmsConsumedByPayConfirm({
    body: msg?.body || msg?.text || parsed.raw || '',
    address: msg?.address || parsed.address || '',
    amount: match.amount,
    date: msg?.date || parsed.date || Date.now(),
  })

  const forLog = {
    amount: match.amount,
    pa: match.pa || parsed.pa,
    payeeName: match.pn || parsed.payeeName,
    source: 'sms',
    personal: match.personal,
    kind: match.personal === false ? 'merchant' : 'p2p',
    forceLog: true,
  }

  let logResult = { logged: false }
  try {
    let accs = accounts
    let cats = categories
    if (!accs?.length || !cats?.length) {
      const [a, c] = await Promise.all([
        client.get('/accounts').catch(() => ({ data: [] })),
        client.get('/categories').catch(() => ({ data: [] })),
      ])
      accs = a.data || []
      cats = c.data || []
    }
    logResult = await handleDetectedUpiPayment(forLog, {
      accounts: accs,
      categories: cats,
    })
    updatePendingP2pPay(match.id, {
      transactionLogged: !!logResult?.logged,
      transactionId: logResult?.transactionId || null,
      logError: logResult?.logged
        ? null
        : (logResult?.error || (logResult?.needsAccount ? 'needs_account' : 'log_failed')),
    })
  } catch (err) {
    updatePendingP2pPay(match.id, {
      transactionLogged: false,
      logError: err?.response?.data?.message || err?.message || 'log_failed',
    })
  }

  // Payment request / split: auto mark sent + drop "Did you pay?"
  try {
    if (match.kind === 'payment_request' && match.requestId) {
      await client.patch(`/payment-requests/${match.requestId}/confirm-sent`).catch(() => {})
    }
    if (match.notificationId) {
      const { clearNotificationPayAction } = await import('./confirmDuePaid.js')
      await clearNotificationPayAction(match.notificationId).catch(() => {})
    }
    const { clearPendingUpiConfirm } = await import('../appLock.js')
    clearPendingUpiConfirm()
    const { upsertSavedContact } = await import('./savedContacts.js')
    upsertSavedContact({
      name: match.pn || parsed.payeeName,
      upiId: match.pa || parsed.pa,
      pa: match.pa || parsed.pa,
    })
  } catch { /* ignore */ }

  const updated = getPendingP2pPay(match.id) || match

  try {
    window.dispatchEvent(new CustomEvent('mm-p2p-sms-confirmed', {
      detail: { pending: updated, parsed, logResult },
    }))
    window.dispatchEvent(new CustomEvent('mm-local-notifications-changed'))
  } catch { /* ignore */ }

  return { pending: updated, parsed, logResult }
}

let drainBusy = false

/**
 * Process live SMS that arrived while the app was killed/backgrounded.
 * Uses the native RECEIVE_SMS queue only — never reads SMS inbox history.
 */
export async function drainLiveSmsQueue() {
  if (!isSmsPaySupported()) return []
  if (!isLoggedIn()) return []
  if (drainBusy) return []
  const perm = await checkSmsPermission()
  if (!perm?.granted) return []

  drainBusy = true
  const results = []
  try {
    const sinceMs = getSmsListenFrom()
    await SmsReader.startWatch({ sinceMs }).catch(() => {})
    const { messages } = await SmsReader.drainLiveQueue()
    const list = Array.isArray(messages) ? messages : []
    let accounts
    let categories
    try {
      const [a, c] = await Promise.all([
        client.get('/accounts').catch(() => ({ data: [] })),
        client.get('/categories').catch(() => ({ data: [] })),
      ])
      accounts = a.data || []
      categories = c.data || []
    } catch { /* ignore */ }

    const ordered = [...list].sort((x, y) => Number(x?.date || 0) - Number(y?.date || 0))
    for (const msg of ordered) {
      if (!isSmsFromPresent(msg)) continue
      try {
        const hit = await processIncomingSms(msg, { accounts, categories })
        if (hit) results.push(hit)
      } catch { /* ignore one bad SMS */ }
    }
  } catch { /* ignore */ } finally {
    drainBusy = false
  }
  return results
}

/** @deprecated name kept for Dashboard/PendingPays — drains live queue only, not inbox. */
export async function scanInboxForPendingPays() {
  return drainLiveSmsQueue()
}

/**
 * Live RECEIVE_SMS (manifest) + drain queue on open. Never fetches past inbox SMS.
 */
export function startSmsPayWatcher() {
  if (!isSmsPaySupported() || started) return () => {}
  started = true
  ensureSmsListenFrom()

  const onSms = async (event) => {
    try {
      const msg = {
        ...event,
        date: event?.date || Date.now(),
        body: event?.body || event?.text || '',
        address: event?.address || '',
      }
      await processIncomingSms(msg)
    } catch { /* ignore */ }
  }

  SmsReader.addListener('bankSms', onSms).then((h) => { listenerHandle = h }).catch(() => {})

  const keepWatchAlive = async () => {
    try {
      if (!isLoggedIn()) return
      const perm = await checkSmsPermission()
      if (!perm?.granted) return
      const sinceMs = ensureSmsListenFrom()
      await SmsReader.startWatch({ sinceMs }).catch(() => {})
      await drainLiveSmsQueue()
    } catch { /* ignore */ }
  }

  keepWatchAlive()
  watchTimer = setInterval(keepWatchAlive, 60_000)

  const onVis = () => {
    if (document.visibilityState === 'visible') keepWatchAlive()
  }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('focus', keepWatchAlive)

  return () => {
    started = false
    listenerHandle?.remove?.()
    listenerHandle = null
    if (watchTimer) clearInterval(watchTimer)
    watchTimer = null
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('focus', keepWatchAlive)
  }
}

export function hasAnyWaitingP2p() {
  return waitingP2pPays().length > 0
}

export { listPendingP2pPays }
