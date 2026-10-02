import { useEffect, useState } from 'react'
import { cancelUpiQrScan, toggleScanTorch } from '../utils/scanUpiQr.js'

/** Full-screen overlay shown while the camera runs behind the WebView. */
export default function QrScannerOverlay({
  open,
  cameraReady,
  torchOn,
  torchAvailable,
  onTorchChange,
  onCancel,
  t,
}) {
  const [busy, setBusy] = useState(false)
  const [torchAnim, setTorchAnim] = useState('idle')

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  // If overlay unmounts unexpectedly, still tear down the native camera.
  useEffect(() => {
    if (!open) return undefined
    return () => {
      cancelUpiQrScan().catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setTorchAnim('idle')
      return
    }
    if (!cameraReady) {
      setTorchAnim(torchOn ? 'warming' : 'idle')
      return
    }
    setTorchAnim(torchOn ? 'on' : 'off-settle')
    const id = window.setTimeout(() => setTorchAnim(torchOn ? 'on' : 'idle'), 450)
    return () => window.clearTimeout(id)
  }, [open, cameraReady, torchOn])

  if (!open) return null

  async function handleTorch() {
    if (!torchAvailable || busy) return
    setBusy(true)
    try {
      const enabled = await toggleScanTorch()
      onTorchChange?.(enabled)
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }

  const torchClass = [
    'scanner-torch-btn px-3 py-2 rounded-lg text-sm font-medium backdrop-blur-sm',
    torchOn ? 'scanner-torch-on' : 'scanner-torch-off',
    torchAnim === 'warming' ? 'scanner-torch-warming' : '',
    torchAnim === 'off-settle' ? 'scanner-torch-off-settle' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="barcode-scanner-modal scanner-overlay-in fixed inset-0 z-[100] flex flex-col text-white">
      <div className="scanner-top-bar flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-lg bg-black/45 text-sm font-medium backdrop-blur-sm"
        >
          {t('Cancel')}
        </button>
        <span className="text-sm font-semibold drop-shadow">{t('Scan UPI QR')}</span>
        {torchAvailable ? (
          <button
            type="button"
            onClick={handleTorch}
            disabled={busy || !cameraReady}
            className={torchClass}
            aria-label={t('Flash')}
            aria-pressed={torchOn}
          >
            <span className="scanner-torch-icon inline-flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M11 21h-1l1-7H7l6-11h1l-1 7h4l-6 11z" />
              </svg>
              {torchOn ? t('Flash on') : t('Flash')}
            </span>
          </button>
        ) : (
          <span className="w-[72px]" />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {!cameraReady && (
          <p className="scanner-status-pulse text-sm text-white/85 mb-4 drop-shadow">
            {t('Opening camera…')}
          </p>
        )}
        <div
          className={`scanner-frame relative w-full max-w-xs aspect-square ${
            cameraReady ? 'scanner-frame-ready' : 'scanner-frame-loading'
          }`}
        >
          <div className="absolute inset-0 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          <span className="scanner-corner absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-teal rounded-tl-xl" />
          <span className="scanner-corner absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-teal rounded-tr-xl" />
          <span className="scanner-corner absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-teal rounded-bl-xl" />
          <span className="scanner-corner absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-teal rounded-br-xl" />
          <div className="scanner-beam absolute left-3 right-3 h-0.5 bg-teal/90 rounded-full" />
        </div>
      </div>

      <p className="text-center text-sm text-white/90 pb-[max(24px,env(safe-area-inset-bottom))] px-6 drop-shadow">
        {cameraReady ? t('Point at a UPI QR code') : t('Flash helps until the camera is visible')}
        {cameraReady && torchOn ? ` · ${t('Flash on for dark rooms')}` : ''}
      </p>
    </div>
  )
}
