import { Capacitor } from '@capacitor/core'
import { BarcodeFormat, BarcodeScanner, LensFacing } from '@capacitor-mlkit/barcode-scanning'
import { suppressResumeLock } from '../appLock.js'

let activeCancel = null
let scanGeneration = 0

async function ensureCameraPermission() {
  const current = await BarcodeScanner.checkPermissions()
  if (current.camera === 'granted' || current.camera === 'limited') return true
  const requested = await BarcodeScanner.requestPermissions()
  return requested.camera === 'granted' || requested.camera === 'limited'
}

function hideScannerChrome() {
  document.body.classList.remove('barcode-scanner-active')
  document.documentElement.style.background = ''
  document.body.style.background = ''
}

async function cleanupScan() {
  hideScannerChrome()
  try { await BarcodeScanner.disableTorch() } catch { /* ignore */ }
  try { await BarcodeScanner.removeAllListeners() } catch { /* ignore */ }
  try { await BarcodeScanner.stopScan() } catch { /* ignore */ }
  activeCancel = null
}

async function ensureGoogleModule(timeoutMs = 12_000) {
  try {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
    if (available) return true
    await Promise.race([
      BarcodeScanner.installGoogleBarcodeScannerModule(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('module-timeout')), timeoutMs)),
    ])
    const again = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
    return !!again.available
  } catch {
    return false
  }
}

/**
 * Opens camera and returns raw QR string.
 * Prefers Google's native scanner UI (reliable — no WebView transparency).
 * Falls back to in-app camera behind WebView + custom overlay.
 */
export async function scanUpiQrNative({ onTorchAvailable, onTorchChange, onPreviewReady, onUsingOverlay } = {}) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('QR camera scan works in the Android app. Paste the UPI link below on web.')
  }

  const supported = await BarcodeScanner.isSupported()
  if (!supported.supported) {
    throw new Error('This device cannot scan QR codes')
  }

  suppressResumeLock(120_000)
  await cleanupScan()
  const gen = ++scanGeneration

  // 1) Google ready-to-use scanner — opens real camera UI, no transparency tricks
  const moduleOk = await ensureGoogleModule()
  if (moduleOk && gen === scanGeneration) {
    try {
      onUsingOverlay?.(false)
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
      })
      if (gen !== scanGeneration) throw new Error('cancelled')
      const value = barcodes?.[0]?.rawValue?.trim()
      if (value) return value
    } catch (err) {
      const msg = err?.message || String(err)
      if (/cancel/i.test(msg)) throw new Error('cancelled')
      // fall through to custom camera
    }
  }

  // 2) Custom in-app camera (behind WebView)
  const allowed = await ensureCameraPermission()
  if (!allowed) {
    try { await BarcodeScanner.openSettings() } catch { /* ignore */ }
    throw new Error('Camera permission is required to scan QR codes. Enable Camera in Settings, then try again.')
  }

  if (gen !== scanGeneration) throw new Error('cancelled')
  onUsingOverlay?.(true)
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  document.body.classList.add('barcode-scanner-active')

  return new Promise((resolve, reject) => {
    let settled = false
    let warmTimer = null

    const finish = async (fn) => {
      if (settled) return
      settled = true
      if (warmTimer != null) {
        clearTimeout(warmTimer)
        warmTimer = null
      }
      activeCancel = null
      hideScannerChrome()
      try { await cleanupScan() } catch { /* ignore */ }
      if (gen === scanGeneration) fn()
    }

    activeCancel = () => finish(() => reject(new Error('cancelled')))

    ;(async () => {
      try {
        await BarcodeScanner.addListener('barcodesScanned', async (event) => {
          if (settled || gen !== scanGeneration) return
          const value = event.barcodes?.[0]?.rawValue?.trim()
          if (!value) return
          await finish(() => resolve(value))
        })

        await BarcodeScanner.addListener('scanError', async (event) => {
          if (settled || gen !== scanGeneration) return
          await finish(() => reject(new Error(event.message || 'Scan failed')))
        })

        if (settled || gen !== scanGeneration) return

        await BarcodeScanner.startScan({
          formats: [BarcodeFormat.QrCode],
          lensFacing: LensFacing.Back,
        })

        if (settled || gen !== scanGeneration) {
          try { await BarcodeScanner.stopScan() } catch { /* ignore */ }
          return
        }

        let torchAvailable = false
        try {
          const { available } = await BarcodeScanner.isTorchAvailable()
          torchAvailable = !!available
          if (!settled && gen === scanGeneration) onTorchAvailable?.(torchAvailable)
        } catch {
          if (!settled && gen === scanGeneration) onTorchAvailable?.(false)
        }

        if (torchAvailable && !settled && gen === scanGeneration) {
          try {
            await BarcodeScanner.enableTorch()
            if (!settled && gen === scanGeneration) onTorchChange?.(true)
          } catch { /* ignore */ }
        }

        await new Promise((r) => { warmTimer = setTimeout(r, 480) })
        warmTimer = null
        if (settled || gen !== scanGeneration) return

        if (torchAvailable) {
          try {
            await BarcodeScanner.disableTorch()
            if (!settled && gen === scanGeneration) onTorchChange?.(false)
          } catch { /* ignore */ }
        }
        if (!settled && gen === scanGeneration) onPreviewReady?.()
      } catch (err) {
        await finish(() => reject(err instanceof Error ? err : new Error(String(err))))
      }
    })()
  })
}

/** Cancels an in-progress custom scan and restores the UI. */
export async function cancelUpiQrScan() {
  hideScannerChrome()
  scanGeneration += 1
  const cancel = activeCancel
  if (cancel) {
    await Promise.resolve(cancel())
    return
  }
  await cleanupScan()
}

export async function toggleScanTorch() {
  const { available } = await BarcodeScanner.isTorchAvailable()
  if (!available) return false
  await BarcodeScanner.toggleTorch()
  const { enabled } = await BarcodeScanner.isTorchEnabled()
  return enabled
}
