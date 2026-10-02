import { useEffect, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { useLanguage } from '../context/LanguageContext.jsx'
import { isNativePlatform } from '../nativePush.js'
import QrScannerOverlay from '../components/QrScannerOverlay.jsx'
import { scanUpiQrNative, cancelUpiQrScan } from '../utils/scanUpiQr.js'
import { parseUpiQr, formatUpiAmount, validateUpiAmount, normalizeVpa } from '../utils/upiQr.js'
import { copyVpaAndOpenApp } from '../utils/upiQr.js'
import { listSavedPayees, upsertSavedPayee } from '../utils/savedPayees.js'
import { rememberLastPayAttempt } from '../utils/paymentNotify.js'

const APPS = [
  { id: 'gpay', label: 'GPay', className: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  { id: 'phonepe', label: 'PhonePe', className: 'bg-brand-500 hover:bg-brand-600 text-white' },
  { id: 'paytm', label: 'Paytm', className: 'bg-sky-500 hover:bg-sky-600 text-white' },
  { id: 'bhim', label: 'BHIM', className: 'bg-orange-500 hover:bg-orange-600 text-white' },
]

export default function Pay() {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [pa, setPa] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [paying, setPaying] = useState(null)
  const [payees, setPayees] = useState(() => listSavedPayees())
  const [scanning, setScanning] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)

  useEffect(() => {
    setPayees(listSavedPayees())
  }, [])

  useEffect(() => {
    if (!scanning) return undefined
    let handle = null
    CapApp.addListener('backButton', () => { handleCancelScan() }).then((h) => { handle = h })
    return () => { handle?.remove() }
  }, [scanning])

  function pickPayee(p) {
    setPa(p.pa || '')
    setName(p.pn || '')
    setError('')
    setHint('')
  }

  async function handleScan() {
    if (!isNativePlatform()) {
      setError(t('Camera scan needs the Android app. On web, paste the UPI link from the QR.'))
      return
    }
    setError('')
    setScanning(true)
    setCameraReady(false)
    try {
      const raw = await scanUpiQrNative({
        onTorchAvailable: setTorchAvailable,
        onTorchChange: setTorchOn,
        onPreviewReady: () => setCameraReady(true),
      })
      const parsed = parseUpiQr(raw)
      setPa(parsed.pa)
      setName(parsed.pn || '')
      if (parsed.am) setAmount(formatUpiAmount(parsed.am))
      setHint(t('QR details filled — pick an app to pay.'))
    } catch (err) {
      const msg = err?.message || String(err)
      if (!/cancel/i.test(msg)) setError(msg)
    } finally {
      setScanning(false)
      setCameraReady(false)
      setTorchOn(false)
      setTorchAvailable(false)
    }
  }

  async function handleCancelScan() {
    setScanning(false)
    setCameraReady(false)
    setTorchOn(false)
    setTorchAvailable(false)
    try { await cancelUpiQrScan() } catch { /* ignore */ }
  }

  async function payWith(appId) {
    setError('')
    setHint('')
    const cleanPa = normalizeVpa(pa)
    const amErr = validateUpiAmount(amount)
    if (!cleanPa || !cleanPa.includes('@')) {
      setError(t('Enter a valid UPI ID'))
      return
    }
    if (amErr) {
      setError(amErr)
      return
    }
    const am = formatUpiAmount(amount)
    setPaying(appId)
    try {
      upsertSavedPayee({ pa: cleanPa, pn: name })
      setPayees(listSavedPayees())
      rememberLastPayAttempt({ pa: cleanPa, pn: name, amount: am })
      await copyVpaAndOpenApp({ pa: cleanPa, amount: am, app: appId })
      setHint(t('UPI ID copied — paste in the app and send ₹') + am)
    } catch (err) {
      setError(err?.message || t('Could not open UPI app'))
    } finally {
      setPaying(null)
    }
  }

  return (
    <div>
      <QrScannerOverlay
        open={scanning}
        cameraReady={cameraReady}
        torchOn={torchOn}
        torchAvailable={torchAvailable}
        onTorchChange={setTorchOn}
        onCancel={handleCancelScan}
        t={t}
      />

      <h1 className="text-2xl font-bold mb-2">{t('Pay')}</h1>
      <p className="page-sub mb-4">
        {t('Enter details or scan a QR, then open GPay / PhonePe and paste the UPI ID.')}
      </p>

      {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      {hint && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 p-2 rounded">{hint}</div>}

      <div className="flex flex-wrap gap-2 mb-4">
        {isNativePlatform() && (
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="bg-slate-800 hover:bg-slate-900 text-white rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {scanning ? t('Scanning…') : t('Scan QR')}
          </button>
        )}
      </div>

      {payees.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-slate-700 mb-2">{t('Saved payees')}</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {payees.slice(0, 12).map((p) => (
              <button
                key={p.pa}
                type="button"
                onClick={() => pickPayee(p)}
                className="shrink-0 max-w-[9.5rem] text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-brand-400"
              >
                <div className="text-sm font-medium truncate">{p.pn || p.pa.split('@')[0]}</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">{p.pa}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 mb-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('Name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Optional')}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('UPI ID')}</label>
          <input
            type="text"
            value={pa}
            onChange={(e) => setPa(e.target.value.trim())}
            placeholder="name@okicici"
            autoCapitalize="off"
            autoCorrect="off"
            className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('Amount')}</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </div>
      </div>

      <div className="text-sm font-medium text-slate-700 mb-2">{t('Pay with')}</div>
      <div className="grid grid-cols-2 gap-2">
        {APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            disabled={!!paying}
            onClick={() => payWith(app.id)}
            className={`rounded-md py-3.5 font-semibold disabled:opacity-60 ${app.className}`}
          >
            {paying === app.id ? t('Opening…') : app.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-3 leading-relaxed">
        {t('We copy the UPI ID and open the app. Paste it in search / Pay UPI ID, enter the amount, and pay.')}
      </p>
    </div>
  )
}
