import { Capacitor } from '@capacitor/core'
import { BarcodeFormat, BarcodeScanner, LensFacing } from '@capacitor-mlkit/barcode-scanning'
import { suppressResumeLock } from '../appLock.js'

let activeCancel = null
let scanGeneration = 0

async function ensureCameraPermission() {
  const current = await BarcodeScanner.checkPermissions()
  if (current.camera === 'granted') return true
  const requested = await BarcodeScanner.requestPermissions()
  return requested.camera === 'granted'
}

function hideScannerChrome() {
  document.body.classList.remove('barcode-scanner-active')
}

async function cleanupScan() {
  hideScannerChrome()
  try { await BarcodeScanner.disableTorch() } catch { /* ignore */ }
  try { await BarcodeScanner.removeAllListeners() } catch { /* ignore */ }
  try { await BarcodeScanner.stopScan() } catch { /* ignore */ }
  activeCancel = null
}

/**
 * Opens an in-app camera scan. Torch turns on while the preview is still coming up,
 * then turns off once the camera is visible (user can toggle flash again in a dark room).
 * Resolves with raw QR string, or rejects on cancel/error.
 */
export async function scanUpiQrNative({ onTorchAvailable, onTorchChange, onPreviewReady } = {}) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('QR camera scan works in the Android app. Paste the UPI link below on web.')
  }

  const supported = await BarcodeScanner.isSupported()
  if (!supported.supported) {
    throw new Error('This device cannot scan QR codes')
  }

  const allowed = await ensureCameraPermission()
  if (!allowed) {
    throw new Error('Camera permission is required to scan QR codes')
  }

  suppressResumeLock(120_000)
  await cleanupScan()
  const gen = ++scanGeneration
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
      // Restore UI immediately — don't wait for native stopScan, or Cancel/Back
      // leaves a blank camera feed with the app hidden behind barcode-scanner-active.
      hideScannerChrome()
      try {
        await cleanupScan()
      } catch { /* ignore */ }
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

        // Preview still settling — flash on so dark rooms aren't a black screen.
        if (torchAvailable && !settled && gen === scanGeneration) {
          try {
            await BarcodeScanner.enableTorch()
            if (!settled && gen === scanGeneration) onTorchChange?.(true)
          } catch { /* ignore */ }
        }

        await new Promise((r) => {
          warmTimer = setTimeout(r, 480)
        })
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

/** Cancels an in-progress scan and always restores the UI (even mid "Opening camera…"). */
export async function cancelUpiQrScan() {
  hideScannerChrome()
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
