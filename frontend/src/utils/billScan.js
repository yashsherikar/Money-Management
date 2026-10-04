/**
 * Bill photo → OCR → parse fields → optional SMS paid check.
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import {
  Camera,
  CameraResultType,
  CameraSource,
  CameraDirection,
} from '@capacitor/camera'
import { parseBillOcrText } from './billParse.js'
import { checkSmsPermission, isSmsPaySupported } from './smsPayWatch.js'
import { parseBankPaymentSms } from './smsPayParse.js'
import { getSmsListenFrom, isSmsFromPresent } from './smsListenGate.js'
import { shouldIgnoreMoneySms } from './smsScamFilter.js'
import { suppressResumeLock } from '../appLock.js'

const BillOcr = registerPlugin('BillOcr')
const SmsReader = registerPlugin('SmsReader')

export function isBillOcrSupported() {
  return Capacitor.isNativePlatform()
}

function isCancelError(err) {
  const msg = String(err?.message || '')
  const code = String(err?.code || '')
  return /cancel/i.test(msg)
    || /OS-PLUG-CAMR-0006/.test(code)
    || /OS-PLUG-CAMR-0020/.test(code)
}

function previewFromMedia(media) {
  if (media?.webPath) return media.webPath
  if (media?.uri) {
    try {
      return Capacitor.convertFileSrc(media.uri)
    } catch { /* ignore */ }
  }
  if (media?.thumbnail) {
    const t = String(media.thumbnail)
    return t.startsWith('data:') ? t : `data:image/jpeg;base64,${t}`
  }
  return ''
}

/** Prefer native URI OCR — avoids huge base64 over the bridge and broken content:// fetch. */
export async function recognizeBillImageUri(uri) {
  if (!isBillOcrSupported()) {
    throw new Error('Bill scan needs the Android app')
  }
  if (!uri) throw new Error('No photo URI')
  const { text } = await BillOcr.recognizeFromUri({ uri })
  return String(text || '')
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

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(blob)
  })
}

async function ensureCameraAccess(needCamera) {
  if (!isBillOcrSupported()) {
    throw new Error('Bill scan needs the Android app')
  }
  const cur = await Camera.checkPermissions()
  const camOk = cur.camera === 'granted' || cur.camera === 'limited'
  const photoOk = cur.photos === 'granted' || cur.photos === 'limited'
  if (needCamera && !camOk) {
    const req = await Camera.requestPermissions({ permissions: ['camera'] })
    if (!(req.camera === 'granted' || req.camera === 'limited')) {
      throw new Error('Camera permission is required. Enable Camera in phone Settings → Apps → Money Manager.')
    }
  }
  if (!needCamera && !photoOk && !camOk) {
    const req = await Camera.requestPermissions({ permissions: ['photos', 'camera'] })
    if (!(req.photos === 'granted' || req.photos === 'limited' || req.camera === 'granted')) {
      throw new Error('Photos permission is required. Enable Photos in phone Settings → Apps → Money Manager.')
    }
  }
}

async function mediaResultToDataUrl(media) {
  const path = media?.uri || media?.webPath
  if (path) {
    try {
      const url = path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')
        ? path
        : Capacitor.convertFileSrc(path)
      const res = await fetch(url)
      const blob = await res.blob()
      if (blob?.size > 0) return blobToDataUrl(blob)
    } catch { /* fall through */ }
  }
  if (media?.thumbnail) {
    const t = String(media.thumbnail)
    return t.startsWith('data:') ? t : `data:image/jpeg;base64,${t}`
  }
  throw new Error('No photo data')
}

async function scanBillFromUri(uri, { categories = [], preview = '' } = {}) {
  const text = await recognizeBillImageUri(uri)
  if (!text.trim()) {
    throw new Error('No text found on this image — try a clearer photo')
  }
  const parsed = parseBillOcrText(text, { categories })
  return {
    ...parsed,
    previewDataUrl: preview || '',
  }
}

/**
 * Open native camera (Capacitor Camera plugin — HTML capture= often fails in WebView).
 */
export async function captureBillPhoto({ categories = [], onPhase } = {}) {
  suppressResumeLock(10 * 60_000)
  await ensureCameraAccess(true)
  suppressResumeLock(10 * 60_000)
  onPhase?.('camera')

  // Camera 8: takePhoto → OCR from file URI (best quality, no bridge base64)
  if (typeof Camera.takePhoto === 'function') {
    try {
      const media = await Camera.takePhoto({
        quality: 90,
        correctOrientation: true,
        targetWidth: 2000,
        targetHeight: 2000,
        saveToGallery: false,
        cameraDirection: CameraDirection.Rear,
      })
      suppressResumeLock(10 * 60_000)
      onPhase?.('ocr')
      if (media?.uri) {
        return scanBillFromUri(media.uri, {
          categories,
          preview: previewFromMedia(media),
        })
      }
      // Rare: no URI — fall back to thumbnail / fetch
      const dataUrl = await mediaResultToDataUrl(media)
      return scanBillFromDataUrl(dataUrl, { categories })
    } catch (err) {
      if (isCancelError(err)) throw err
      // fall through to getPhoto
    }
  }

  onPhase?.('camera')
  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    direction: CameraDirection.Rear,
    correctOrientation: true,
    width: 2000,
  })
  suppressResumeLock(10 * 60_000)
  onPhase?.('ocr')
  // Prefer path/uri when present (smaller bridge traffic)
  if (photo?.path) {
    try {
      const uri = String(photo.path).startsWith('file:') ? photo.path : `file://${photo.path}`
      return scanBillFromUri(uri, {
        categories,
        preview: photo?.webPath || Capacitor.convertFileSrc(photo.path),
      })
    } catch { /* use dataUrl */ }
  }
  const dataUrl = photo?.dataUrl
  if (!dataUrl) throw new Error('No photo captured')
  return scanBillFromDataUrl(dataUrl, { categories })
}

/** Open native gallery / photo picker. */
export async function pickBillPhoto({ categories = [], onPhase } = {}) {
  suppressResumeLock(10 * 60_000)
  await ensureCameraAccess(false)
  suppressResumeLock(10 * 60_000)
  onPhase?.('gallery')

  if (typeof Camera.chooseFromGallery === 'function') {
    try {
      const { results } = await Camera.chooseFromGallery({
        quality: 90,
        correctOrientation: true,
        targetWidth: 2000,
        targetHeight: 2000,
        allowMultipleSelection: false,
      })
      const media = results?.[0]
      if (!media) throw new Error('No image selected')
      suppressResumeLock(10 * 60_000)
      onPhase?.('ocr')
      if (media.uri) {
        return scanBillFromUri(media.uri, {
          categories,
          preview: previewFromMedia(media),
        })
      }
      const dataUrl = await mediaResultToDataUrl(media)
      return scanBillFromDataUrl(dataUrl, { categories })
    } catch (err) {
      if (isCancelError(err)) throw err
      // fall through
    }
  }

  onPhase?.('gallery')
  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
    correctOrientation: true,
    width: 2000,
  })
  suppressResumeLock(10 * 60_000)
  onPhase?.('ocr')
  if (photo?.path) {
    try {
      const uri = String(photo.path).startsWith('file:') ? photo.path : `file://${photo.path}`
      return scanBillFromUri(uri, {
        categories,
        preview: photo?.webPath || Capacitor.convertFileSrc(photo.path),
      })
    } catch { /* use dataUrl */ }
  }
  const dataUrl = photo?.dataUrl
  if (!dataUrl) throw new Error('No image selected')
  return scanBillFromDataUrl(dataUrl, { categories })
}

export async function scanBillFromDataUrl(dataUrl, { categories = [] } = {}) {
  const text = await recognizeBillImageBase64(dataUrl)
  if (!text.trim()) {
    throw new Error('No text found on this image — try a clearer photo')
  }
  const parsed = parseBillOcrText(text, { categories })
  return {
    ...parsed,
    previewDataUrl: dataUrl.startsWith('data:') ? dataUrl : `data:image/jpeg;base64,${dataUrl}`,
  }
}

export async function scanBillFromFile(file, { categories = [] } = {}) {
  const base64 = await fileToBase64(file)
  return scanBillFromDataUrl(base64, { categories })
}

/**
 * Check recent bank SMS for a debit matching this bill amount (and optional merchant).
 */
export async function checkBillPaidInSms({
  amount,
  merchant = '',
  sinceMs,
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
    const floor = getSmsListenFrom()
    const since = Math.max(floor, Number(sinceMs) || Date.now() - 2 * 60 * 60_000)
    const { messages } = await SmsReader.readRecent({ sinceMs: since, limit: 40 })
    const merchantBits = String(merchant || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4)
      .slice(0, 4)

    let best = null
    for (const msg of messages || []) {
      if (!isSmsFromPresent(msg)) continue
      const body = msg.body || msg.text || ''
      const address = msg.address || ''
      if (shouldIgnoreMoneySms({ body, address })) continue
      const parsed = parseBankPaymentSms({
        body,
        address,
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
