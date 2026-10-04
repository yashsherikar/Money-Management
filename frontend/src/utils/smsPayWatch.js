import { Capacitor, registerPlugin } from '@capacitor/core'
import { parseBankPaymentSms, parseUpiPaymentFailedSms, pickBestPendingMatch, namesLookSame } from './smsPayParse.js'
import {
  waitingP2pPays,
  markPendingP2pConfirmed,
  markPendingP2pFailed,
  listPendingP2pPays,
  updatePendingP2pPay,
  getPendingP2pPay,
} from './pendingP2pPays.js'
import { handleDetectedUpiPayment } from './paymentNotify.js'
import { processAutopaySms, markSmsConsumedByPayConfirm } from './autopayDetect.js'
import { processAutopayStopSms, isAutopayStopSms } from './autopayStopDetect.js'
import { parseBankMoneySms } from './smsBankParse.js'
import { shouldIgnoreMoneySms } from './smsScamFilter.js'
import {
  ensureSmsListenFrom,
  getSmsListenFrom,
  markSmsListenFromNowIfUnset,
  isSmsFromPresent,
} from './smsListenGate.js'
import client from '../api/client'
import { isLoggedIn } from './userStorage.js'

const SmsReader = registerPlugin('SmsReader')

let started = false
let listenerHandle = null
let watchTimer = null
const processedKeys = new Set()

/** Serialize credit/debit/cashback SMS so simultaneous bursts never race. */
const smsJobQueue = []
let smsJobsRunning = false
let drainBusy = false
let drainAgain = false

async function runSmsJobs() {
  if (smsJobsRunning) return
  smsJobsRunning = true
  try {
    while (smsJobQueue.length) {
      const job = smsJobQueue.shift()
      try {
        await job()
      } catch { /* one bad SMS must not block the rest */ }
    }
  } finally {
    smsJobsRunning = false
    // More jobs may have been pushed while we were finishing
    if (smsJobQueue.length) runSmsJobs()
  }
}

/** Enqueue SMS work (process one message or a drain batch) in order. */
function enqueueSmsJob(fn) {
  return new Promise((resolve) => {
    smsJobQueue.push(async () => {
      try {
        resolve(await fn())
      } catch {
        resolve(null)
      }
    })
    runSmsJobs()
  })
}

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

const BATTERY_PROMPT_KEY = 'mm_sms_battery_prompted_v1'

export async function getSmsBatteryStatus() {
  if (!isSmsPaySupported()) {
    return { ignoringOptimizations: true, batteryOptimized: false, manufacturer: '', brand: '' }
  }
  try {
    const ret = await SmsReader.getBatteryStatus()
    return {
      ignoringOptimizations: !!ret?.ignoringOptimizations,
      batteryOptimized: !!ret?.batteryOptimized,
      manufacturer: ret?.manufacturer || '',
      brand: ret?.brand || '',
      ...ret,
    }
  } catch {
    return { ignoringOptimizations: false, batteryOptimized: true, manufacturer: '', brand: '' }
  }
}

/** System dialog → Unrestricted / ignore battery optimizations (needed when app is killed). */
export async function requestIgnoreBatteryOptimizations() {
  if (!isSmsPaySupported()) return { ignoringOptimizations: true, opened: false }
  try {
    return await SmsReader.requestIgnoreBatteryOptimizations()
  } catch {
    return { ignoringOptimizations: false, opened: false }
  }
}

export async function openSmsBatterySettings() {
  if (!isSmsPaySupported()) return
  try {
    await SmsReader.openBatterySettings()
  } catch { /* ignore */ }
}

/** OEM Autostart / allow background (Xiaomi, Oppo, Vivo, etc.). */
export async function openSmsAutostartSettings() {
  if (!isSmsPaySupported()) return
  try {
    await SmsReader.openAutostartSettings()
  } catch { /* ignore */ }
}

/**
 * After SMS is granted: if Battery Saver still restricts the app, prompt once
 * so RECEIVE_SMS works when the process is killed.
 */
export async function ensureSmsBackgroundAllowed({ force = false } = {}) {
  if (!isSmsPaySupported()) return { ok: true }
  const status = await getSmsBatteryStatus()
  if (status.ignoringOptimizations) return { ok: true, ...status }
  if (!force) {
    try {
      if (localStorage.getItem(BATTERY_PROMPT_KEY) === '1') return { ok: false, skipped: true, ...status }
    } catch { /* ignore */ }
  }
  try {
    localStorage.setItem(BATTERY_PROMPT_KEY, '1')
  } catch { /* ignore */ }
  const ret = await requestIgnoreBatteryOptimizations()
  return { ok: !!ret?.ignoringOptimizations, prompted: true, ...status, ...ret }
}

export async function requestSmsPermission() {
  if (!isSmsPaySupported()) return { granted: false }
  try {
    const ret = await SmsReader.requestPermissions()
    const granted = !!(ret?.granted || ret?.sms === 'granted' || ret?.sms === 'GRANTED')
    if (granted) {
      // Arm once — do NOT reset listen window on every Pay/Settings permission check
      // (resetting was dropping delayed bank SMS stamped before "now")
      markSmsListenFromNowIfUnset()
      await SmsReader.startWatch({ sinceMs: getSmsListenFrom() }).catch(() => {})
      // Only live SMS queued while granting (not inbox history)
      drainLiveSmsQueue().catch(() => {})
      // Battery Saver / Doze often blocks SMS when app is killed — ask Unrestricted
      ensureSmsBackgroundAllowed().catch(() => {})
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

  // UPI / payment failed while waiting for QR confirm — stop hanging on "waiting SMS"
  try {
    const failed = parseUpiPaymentFailedSms({
      body,
      address,
      date: msg?.date || Date.now(),
    })
    if (failed) {
      const waiting = waitingP2pPays()
      // Failures need VPA/name — never amount-only (wrong pending would stop waiting)
      const match = pickBestPendingMatch(failed, waiting, { requireIdentity: true })
      if (match) {
        markPendingP2pFailed(match.id, { smsRaw: failed.raw, reason: 'payment_failed' })
        return { payFailed: true, pendingId: match.id }
      }
    }
  } catch { /* ignore */ }

  // Ads / scam / spam / no real debit or credit → ignore
  // (failed-pay SMS often lacks credit/debit verbs — handled above first)
  if (shouldIgnoreMoneySms({ body, address })) return null

  // Credits that arrive while QR pay is waiting (cashback / refund / interest / salary)
  // — never block behind debit-only QR matching
  try {
    const money = parseBankMoneySms({
      body,
      address,
      date: msg?.date || Date.now(),
      includeUpiPayment: true,
    })
    const creditKinds = new Set(['cashback', 'refund', 'interest'])
    if (money?.direction === 'CREDIT' && (creditKinds.has(money.kind) || money.kind === 'payment')) {
      const ap = await processAutopaySms(msg, { accounts, categories })
      if (ap) {
        return {
          credit: ap,
          cashback: money.kind === 'cashback' ? ap : undefined,
          autopay: ap,
        }
      }
    }
  } catch { /* fall through to QR / other bank SMS */ }

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

    // Pending already confirmed (app reopen / re-drain) — suppress only with identity match
    const confirmed = listPendingP2pPays().find((p) => {
      if (p.status !== 'confirmed') return false
      if (Math.abs(Number(p.amount) - Number(parsed.amount)) > 0.011) return false
      const created = Number(p.createdAt) || 0
      const confirmedAt = Number(p.confirmedAt) || created
      const smsDate = Number(msg?.date || parsed.date) || Date.now()
      if (smsDate < created - 2 * 60_000) return false
      if (smsDate > confirmedAt + 24 * 60 * 60_000) return false
      const smsPa = String(parsed.pa || '').toLowerCase()
      const pendingPa = String(p.pa || '').toLowerCase()
      if (pendingPa && smsPa && pendingPa === smsPa) return true
      if (namesLookSame(parsed.payeeName, p.pn || p.name)) return true
      // Already logged this pay — suppress nameless bank SMS after manual/notify confirm
      if (p.transactionLogged && !parsed.payeeName && !smsPa) return true
      return false
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

  // Do not show "forgot expense / pick category" for this same bank SMS
  markSmsConsumedByPayConfirm({
    body: msg?.body || msg?.text || parsed.raw || '',
    address: msg?.address || parsed.address || '',
    amount: match.amount,
    date: msg?.date || parsed.date || Date.now(),
  })

  let logResult = { logged: false }

  // Already logged via notify / "Did you pay?" — mark confirmed, never double-POST
  if (match.transactionLogged) {
    markPendingP2pConfirmed(match.id, {
      smsRaw: parsed.raw,
      source: 'sms',
      transactionLogged: true,
      transactionId: match.transactionId || null,
    })
    logResult = { logged: true, duplicate: true, transactionId: match.transactionId }
  } else {
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
      categoryId: match.categoryId || null,
      description: match.description || null,
    }

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
      const ok = !!logResult?.logged || !!logResult?.duplicate
      updatePendingP2pPay(match.id, {
        transactionLogged: ok,
        transactionId: logResult?.transactionId || match.transactionId || null,
        logError: ok
          ? null
          : (logResult?.error || (logResult?.needsAccount ? 'needs_account' : 'log_failed')),
      })
    } catch (err) {
      updatePendingP2pPay(match.id, {
        transactionLogged: false,
        logError: err?.response?.data?.message || err?.message || 'log_failed',
      })
    }
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

/**
 * Process live SMS that arrived while the app was killed/backgrounded.
 * Uses the native RECEIVE_SMS queue only — never reads SMS inbox history.
 * If more SMS arrive mid-drain, loops again so none are skipped.
 */
export async function drainLiveSmsQueue() {
  if (!isSmsPaySupported()) return []
  if (!isLoggedIn()) return []
  if (drainBusy) {
    drainAgain = true
    return []
  }
  const perm = await checkSmsPermission()
  if (!perm?.granted) return []

  return enqueueSmsJob(async () => {
    if (drainBusy) {
      drainAgain = true
      return []
    }
    drainBusy = true
    const results = []
    try {
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

      do {
        drainAgain = false
        const sinceMs = getSmsListenFrom()
        await SmsReader.startWatch({ sinceMs }).catch(() => {})
        const { messages } = await SmsReader.drainLiveQueue()
        const list = Array.isArray(messages) ? messages : []
        const ordered = [...list].sort((x, y) => Number(x?.date || 0) - Number(y?.date || 0))
        for (const msg of ordered) {
          if (!isSmsFromPresent(msg)) continue
          try {
            const hit = await processIncomingSms(msg, { accounts, categories })
            if (hit) results.push(hit)
          } catch { /* ignore one bad SMS — keep going through the burst */ }
        }
      } while (drainAgain)
    } catch { /* ignore */ } finally {
      drainBusy = false
      if (drainAgain) {
        // Native enqueue raced the last clear — schedule another pass
        drainAgain = false
        setTimeout(() => { drainLiveSmsQueue().catch(() => {}) }, 250)
      }
    }
    return results
  })
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

  const onSms = (event) => {
    // Never process parallel bankSms events — debit + credit + cashback often land together
    enqueueSmsJob(async () => {
      const msg = {
        ...event,
        date: event?.date || Date.now(),
        body: event?.body || event?.text || '',
        address: event?.address || '',
      }
      return processIncomingSms(msg)
    })
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
