import { Capacitor, registerPlugin } from '@capacitor/core'
import { parseBankPaymentSms, pickBestPendingMatch } from './smsPayParse.js'
import {
  waitingP2pPays,
  markPendingP2pConfirmed,
  listPendingP2pPays,
} from './pendingP2pPays.js'
import { handleDetectedUpiPayment } from './paymentNotify.js'
import client from '../api/client'

const SmsReader = registerPlugin('SmsReader')

let started = false
let listenerHandle = null
let scanTimer = null
let processing = false
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
    if (granted) await SmsReader.startWatch().catch(() => {})
    return { ...ret, granted }
  } catch {
    return { granted: false }
  }
}

/**
 * Process one SMS body against waiting P2P pays.
 * On match → mark confirmed + auto-log expense (or category prompt).
 */
export async function processIncomingSms(msg, { accounts, categories } = {}) {
  const parsed = parseBankPaymentSms({
    body: msg?.body || msg?.text || '',
    address: msg?.address || '',
    date: msg?.date || Date.now(),
  })
  if (!parsed) return null

  const key = smsKey(msg, parsed)
  if (processedKeys.has(key)) return null

  const waiting = waitingP2pPays()
  if (!waiting.length) return null

  const match = pickBestPendingMatch(parsed, waiting)
  if (!match) return null

  // Claim immediately so inbox rescan + live SMS can't double-confirm
  rememberProcessed(key)
  const updated = markPendingP2pConfirmed(match.id, {
    smsRaw: parsed.raw,
    source: 'sms',
  })
  if (!updated || updated.status !== 'confirmed') return null

  const forLog = {
    amount: match.amount,
    pa: match.pa || parsed.pa,
    payeeName: match.pn || parsed.payeeName,
    source: 'sms',
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
    logResult = await handleDetectedUpiPayment(forLog, { accounts: accs, categories: cats })
  } catch { /* status already confirmed */ }

  try {
    window.dispatchEvent(new CustomEvent('mm-p2p-sms-confirmed', {
      detail: { pending: updated, parsed, logResult },
    }))
  } catch { /* ignore */ }

  return { pending: updated, parsed, logResult }
}

/** Scan inbox since earliest waiting pay (handles 5–15 min late SMS). */
export async function scanInboxForPendingPays(opts = {}) {
  if (!isSmsPaySupported()) return []
  const perm = await checkSmsPermission()
  if (!perm?.granted) return []

  const waiting = waitingP2pPays()
  if (!waiting.length) return []

  if (processing) return []
  processing = true
  try {
    const earliest = Math.min(...waiting.map((w) => (w.createdAt || Date.now()) - 2 * 60_000))
    await SmsReader.startWatch().catch(() => {})
    const { messages } = await SmsReader.readRecent({
      sinceMs: earliest,
      limit: 100,
    })
    const confirmed = []
    // Oldest first so earlier pays match first when amounts collide
    const ordered = [...(messages || [])].sort((a, b) => (a.date || 0) - (b.date || 0))
    for (const msg of ordered) {
      if (!waitingP2pPays().length) break
      const result = await processIncomingSms(msg, opts)
      if (result) confirmed.push(result)
    }
    return confirmed
  } catch {
    return []
  } finally {
    processing = false
  }
}

/**
 * Start global SMS watch + periodic inbox scan while there are waiting pays.
 * Call once from App (native).
 */
export function startSmsPayWatcher() {
  if (!isSmsPaySupported() || started) return () => {}
  started = true

  const onSms = async (event) => {
    try {
      await processIncomingSms(event)
    } catch { /* ignore */ }
  }

  SmsReader.addListener('bankSms', onSms).then((h) => { listenerHandle = h }).catch(() => {})

  const tick = async () => {
    try {
      if (!waitingP2pPays().length) return
      const perm = await checkSmsPermission()
      if (perm?.granted) {
        await SmsReader.startWatch().catch(() => {})
        await scanInboxForPendingPays()
      }
    } catch { /* ignore */ }
  }

  tick()
  scanTimer = setInterval(tick, 30_000)

  const onVis = () => {
    if (document.visibilityState === 'visible') tick()
  }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('focus', tick)
  window.addEventListener('mm-pending-p2p-changed', tick)

  return () => {
    started = false
    listenerHandle?.remove?.()
    listenerHandle = null
    if (scanTimer) clearInterval(scanTimer)
    scanTimer = null
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('focus', tick)
    window.removeEventListener('mm-pending-p2p-changed', tick)
  }
}

export function hasAnyWaitingP2p() {
  return waitingP2pPays().length > 0
}

export { listPendingP2pPays }
