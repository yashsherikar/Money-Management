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
import { processAutopaySms } from './autopayDetect.js'
import { processAutopayStopSms, isAutopayStopSms } from './autopayStopDetect.js'
import { shouldIgnoreMoneySms } from './smsScamFilter.js'
import {
  ensureSmsListenFrom,
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
      markSmsListenFromNow()
      await SmsReader.startWatch().catch(() => {})
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

  const waiting = waitingP2pPays()
  if (parsed && waiting.length) {
    const key = smsKey(msg, parsed)
    if (!processedKeys.has(key)) {
      const match = pickBestPendingMatch(parsed, waiting)
      if (match) {
        return confirmPendingFromSms(msg, parsed, match, key, { accounts, categories })
      }
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

  const updated = getPendingP2pPay(match.id) || match

  try {
    window.dispatchEvent(new CustomEvent('mm-p2p-sms-confirmed', {
      detail: { pending: updated, parsed, logResult },
    }))
  } catch { /* ignore */ }

  return { pending: updated, parsed, logResult }
}

/**
 * Past inbox scan disabled — only live SMS after listen-from.
 * Kept as a no-op so older callers (Dashboard / PendingPays) don't pull history.
 */
export async function scanInboxForPendingPays() {
  if (!isSmsPaySupported()) return []
  const perm = await checkSmsPermission()
  if (!perm?.granted) return []
  ensureSmsListenFrom()
  await SmsReader.startWatch().catch(() => {})
  return []
}

/**
 * Start live SMS watch only — no past inbox fetch, no periodic history scan.
 */
export function startSmsPayWatcher() {
  if (!isSmsPaySupported() || started) return () => {}
  started = true
  ensureSmsListenFrom()

  const onSms = async (event) => {
    try {
      // Live broadcast: stamp "now" if native omitted date
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
      ensureSmsListenFrom()
      await SmsReader.startWatch().catch(() => {})
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
