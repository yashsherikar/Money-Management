import { Capacitor } from '@capacitor/core'
import { BarcodeFormat, BarcodeScanner, LensFacing } from '@capacitor-mlkit/barcode-scanning'
import { suppressResumeLock } from '../appLock.js'

let activeCancel = null

async function ensureCameraPermission() {
  const current = await BarcodeScanner.checkPermissions()
  if (current.camera === 'granted') return true
  const requested = await BarcodeScanner.requestPermissions()
  return requested.camera === 'granted'
}

async function cleanupScan() {
  try { await BarcodeScanner.disableTorch() } catch { /* ignore */ }
  try { await BarcodeScanner.removeAllListeners() } catch { /* ignore */ }
  try { await BarcodeScanner.stopScan() } catch { /* ignore */ }
  document.body.classList.remove('barcode-scanner-active')
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
  document.body.classList.add('barcode-scanner-active')

  return new Promise((resolve, reject) => {
    let settled = false

    const finish = async (fn) => {
      if (settled) return
      settled = true
      activeCancel = null
      await cleanupScan()
      fn()
    }

    activeCancel = () => finish(() => reject(new Error('cancelled')))

    ;(async () => {
      try {
        await BarcodeScanner.addListener('barcodesScanned', async (event) => {
          const value = event.barcodes?.[0]?.rawValue?.trim()
          if (!value) return
          await finish(() => resolve(value))
        })

        await BarcodeScanner.addListener('scanError', async (event) => {
          await finish(() => reject(new Error(event.message || 'Scan failed')))
        })

        await BarcodeScanner.startScan({
          formats: [BarcodeFormat.QrCode],
          lensFacing: LensFacing.Back,
        })

        let torchAvailable = false
        try {
          const { available } = await BarcodeScanner.isTorchAvailable()
          torchAvailable = !!available
          onTorchAvailable?.(torchAvailable)
        } catch {
          onTorchAvailable?.(false)
        }

        // Preview still settling — flash on so dark rooms aren't a black screen.
        if (torchAvailable) {
          try {
            await BarcodeScanner.enableTorch()
            onTorchChange?.(true)
          } catch { /* ignore */ }
        }

        await new Promise((resolve) => setTimeout(resolve, 480))

        if (torchAvailable) {
          try {
            await BarcodeScanner.disableTorch()
            onTorchChange?.(false)
          } catch { /* ignore */ }
        }
        onPreviewReady?.()
      } catch (err) {
        await finish(() => reject(err instanceof Error ? err : new Error(String(err))))
      }
    })()
  })
}

export async function cancelUpiQrScan() {
  if (activeCancel) activeCancel()
  else await cleanupScan()
}

export async function toggleScanTorch() {
  const { available } = await BarcodeScanner.isTorchAvailable()
  if (!available) return false
  await BarcodeScanner.toggleTorch()
  const { enabled } = await BarcodeScanner.isTorchEnabled()
  return enabled
}
