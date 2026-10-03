/**
 * Bill photo → OCR → parse fields → optional SMS paid check.
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import { parseBillOcrText } from './billParse.js'
import { checkSmsPermission, isSmsPaySupported } from './smsPayWatch.js'
import { parseBankPaymentSms } from './smsPayParse.js'

const BillOcr = registerPlugin('BillOcr')
const SmsReader = registerPlugin('SmsReader')

export function isBillOcrSupported() {
  return Capacitor.isNativePlatform()
}

export async function recognizeBillImageBase64(base64) {
  if (!isBillOcrSupported()) {
    throw new Error('Bill scan needs the Android app')
  }
  const { text } = await BillOcr.recognize({ base64 })
  return String(text || '')
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

export async function scanBillFromFile(file, { categories = [] } = {}) {
  const base64 = await fileToBase64(file)
  const text = await recognizeBillImageBase64(base64)
  if (!text.trim()) {
    throw new Error('No text found on this image — try a clearer photo')
  }
  const parsed = parseBillOcrText(text, { categories })
  return {
    ...parsed,
    previewDataUrl: base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`,
  }
}

/**
 * Check recent bank SMS for a debit matching this bill amount (and optional merchant).
 */
export async function checkBillPaidInSms({
  amount,
  merchant = '',
  sinceMs = Date.now() - 7 * 24 * 60 * 60_000,
} = {}) {
  if (!isSmsPaySupported()) {
    return { checked: false, matched: false, reason: 'sms_unavailable' }
  }
  const perm = await checkSmsPermission()
  if (!perm?.granted) {
    return { checked: false, matched: false, reason: 'sms_permission' }
  }

  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt < 1) {
    return { checked: false, matched: false, reason: 'no_amount' }
  }

  try {
    await SmsReader.startWatch().catch(() => {})
    const { messages } = await SmsReader.readRecent({ sinceMs, limit: 120 })
    const merchantBits = String(merchant || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4)
      .slice(0, 4)

    let best = null
    for (const msg of messages || []) {
      const parsed = parseBankPaymentSms({
        body: msg.body || msg.text || '',
        address: msg.address || '',
        date: msg.date || 0,
      })
      if (!parsed) continue
      if (Math.abs(Number(parsed.amount) - amt) > 0.05) continue

      const hay = `${parsed.raw || ''} ${parsed.payeeName || ''}`.toLowerCase()
      const merchantHit = merchantBits.length
        ? merchantBits.some((w) => hay.includes(w))
        : false
      const score = (merchantHit ? 10 : 0) + 1
      if (!best || score > best.score) {
        best = { parsed, score, merchantHit }
      }
    }

    if (!best) {
      return { checked: true, matched: false, reason: 'no_match' }
    }
    return {
      checked: true,
      matched: true,
      merchantHit: !!best.merchantHit,
      sms: {
        amount: best.parsed.amount,
        payeeName: best.parsed.payeeName,
        date: best.parsed.date,
        raw: best.parsed.raw,
        address: best.parsed.address,
      },
    }
  } catch (err) {
    return { checked: false, matched: false, reason: 'sms_error', error: err?.message }
  }
}
