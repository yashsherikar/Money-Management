import { useEffect, useState } from 'react'
import { cancelUpiQrScan, toggleScanTorch } from '../utils/scanUpiQr.js'

/** Full-screen overlay shown while the camera runs behind the WebView. */
export default function QrScannerOverlay({ open, torchOn, torchAvailable, onTorchChange, onCancel, t }) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

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

  return (
    <div className="barcode-scanner-modal fixed inset-0 z-[100] flex flex-col text-white">
      <div className="flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
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
            disabled={busy}
            className={`px-3 py-2 rounded-lg text-sm font-medium backdrop-blur-sm ${
              torchOn ? 'bg-amber-400 text-slate-900' : 'bg-black/45'
            }`}
            aria-label={t('Flash')}
          >
            {torchOn ? t('Flash on') : t('Flash')}
          </button>
        ) : (
          <span className="w-[72px]" />
        )}
      </div>

      <div className="flex-1 flex items-center justify-center px-8">
        <div className="relative w-full max-w-xs aspect-square">
          <div className="absolute inset-0 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          <span className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-teal rounded-tl-xl" />
          <span className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-teal rounded-tr-xl" />
          <span className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-teal rounded-bl-xl" />
          <span className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-teal rounded-br-xl" />
          <div className="absolute left-3 right-3 top-1/2 h-0.5 bg-teal/90 animate-pulse" />
        </div>
      </div>

      <p className="text-center text-sm text-white/90 pb-[max(24px,env(safe-area-inset-bottom))] px-6 drop-shadow">
        {t('Point at a UPI QR code')}
        {torchOn ? ` · ${t('Flash on for dark rooms')}` : ''}
      </p>
    </div>
  )
}
