import { useEffect, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { useLanguage } from '../context/LanguageContext.jsx'
import { isNativePlatform } from '../nativePush.js'
import QrScannerOverlay from '../components/QrScannerOverlay.jsx'
import { scanUpiQrNative, cancelUpiQrScan } from '../utils/scanUpiQr.js'
import {
  parseUpiQr,
  formatUpiAmount,
  validateUpiAmount,
  normalizeVpa,
  isPersonalUpi,
  copyVpaAndOpenApp,
  openUpiPayLink,
  buildUpiPayLink,
  savePayQrToGallery,
} from '../utils/upiQr.js'
import { listSavedPayees, upsertSavedPayee } from '../utils/savedPayees.js'
import { rememberLastPayAttempt } from '../utils/paymentNotify.js'
import { addPendingP2pPay } from '../utils/pendingP2pPays.js'
import { requestSmsPermission, isSmsPaySupported, checkSmsPermission } from '../utils/smsPayWatch.js'
import { useNavigate } from 'react-router-dom'
import { suppressResumeLock } from '../appLock.js'

/** Simple brand marks (inline SVG) — no external logo assets needed. */
const APPS = [
  {
    id: 'gpay',
    label: 'GPay',
    className: 'bg-white text-slate-900 border border-slate-200',
    logo: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden>
        <path fill="#4285F4" d="M12 11.5v2.7h6.1c-.3 1.5-1.9 4.4-6.1 4.4-3.7 0-6.7-3-6.7-6.8s3-6.8 6.7-6.8c2.1 0 3.5.9 4.3 1.7l2.9-2.8C17.5 2.3 15 1.2 12 1.2 6.5 1.2 2 5.7 2 11.2S6.5 21.2 12 21.2c6.1 0 10.1-4.3 10.1-10.3 0-.7-.1-1.2-.2-1.7H12z" />
        <path fill="#34A853" d="M3.2 7.4 5.4 9c.6-1.8 2.2-3.4 4.6-3.6V3.2C6.8 3.4 4.3 5 3.2 7.4z" opacity=".9" />
        <path fill="#FBBC05" d="M12 21.2c2.7 0 5-.9 6.6-2.4l-2.9-2.3c-.8.6-2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5l-3.1 2.4c1.6 3.2 4.9 5.7 9.3 5.7z" opacity=".95" />
        <path fill="#EA4335" d="M18.6 6.6 15.7 9c.8.6 1.4 1.5 1.4 2.7H12v2.7h7.8c.1-.5.2-1.1.2-1.7 0-2.5-.7-4.4-1.4-6.1z" opacity=".85" />
      </svg>
    ),
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    className: 'bg-[#5f259f] text-white',
    logo: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#5f259f" />
        <path fill="#fff" d="M13.2 6.2h-2.1c-2.6 0-4.3 1.5-4.3 3.9 0 2.6 1.8 3.9 4.5 3.9h.7v1.3c0 .7-.3 1-1 1H9.2v1.9h2.1c2.3 0 3.6-1.2 3.6-3.1v-6.2c0-1.5-.9-2.7-1.7-2.7zm-.5 5.8h-.6c-1.3 0-2.1-.6-2.1-1.8s.8-1.8 2.1-1.8h.6v3.6z" />
      </svg>
    ),
  },
  {
    id: 'paytm',
    label: 'Paytm',
    className: 'bg-[#00BAF2] text-white',
    logo: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden>
        <rect width="24" height="24" rx="5" fill="#00BAF2" />
        <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700" fontFamily="Arial">Paytm</text>
      </svg>
    ),
  },
  {
    id: 'bhim',
    label: 'BHIM',
    className: 'bg-[#FF6F00] text-white',
    logo: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden>
        <rect width="24" height="24" rx="5" fill="#FF6F00" />
        <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="Arial">UPI</text>
      </svg>
    ),
  },
]

export default function Pay() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [pa, setPa] = useState('')
  const [amount, setAmount] = useState('')
  const [mc, setMc] = useState('')
  const [tn, setTn] = useState('')
  const [personal, setPersonal] = useState(true)
  const [paste, setPaste] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [paying, setPaying] = useState(null)
  const [qrBusy, setQrBusy] = useState(false)
  const [payees, setPayees] = useState(() => listSavedPayees())
  const [scanning, setScanning] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    setPayees(listSavedPayees())
  }, [])

  useEffect(() => {
    if (!scanning) return undefined
    let handle = null
    CapApp.addListener('backButton', () => { handleCancelScan() }).then((h) => { handle = h })
    return () => { handle?.remove() }
  }, [scanning])

  function applyParsed(parsed) {
    setPa(parsed.pa)
    setName(parsed.pn || '')
    setMc(parsed.mc || '')
    setTn(parsed.tn || '')
    const isP2p = parsed.personal ?? isPersonalUpi(parsed.mc)
    setPersonal(isP2p)
    if (parsed.am) setAmount(formatUpiAmount(parsed.am))
    setScanned(true)
    setHint(
      isP2p
        ? t('Personal QR scanned. Apps below copy UPI ID (enter amount in the app), or save QR to gallery with amount.')
        : t('Merchant QR scanned. Apps below open with name + amount filled.'),
    )
  }

  function pickPayee(p) {
    setPa(p.pa || '')
    setName(p.pn || '')
    setMc('')
    setTn('')
    setPersonal(true)
    setScanned(false)
    setError('')
    setHint('')
  }

  async function handleScan() {
    if (!isNativePlatform()) {
      setError(t('Camera scan needs the Android app. On web, paste the UPI link from the QR.'))
      return
    }
    setError('')
    setHint(t('Opening camera…'))
    setScanBusy(true)
    setScanning(false)
    setCameraReady(false)
    try {
      const raw = await scanUpiQrNative({
        onUsingOverlay: (useOverlay) => {
          setScanning(!!useOverlay)
          if (!useOverlay) setHint(t('Opening camera…'))
        },
        onTorchAvailable: setTorchAvailable,
        onTorchChange: setTorchOn,
        onPreviewReady: () => setCameraReady(true),
      })
      setHint('')
      applyParsed(parseUpiQr(raw))
    } catch (err) {
      const msg = err?.message || String(err)
      if (!/cancel/i.test(msg)) setError(msg)
      setHint('')
    } finally {
      setScanBusy(false)
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

  function handlePasteParse(e) {
    e.preventDefault()
    setError('')
    try {
      applyParsed(parseUpiQr(paste))
      setPaste('')
    } catch (err) {
      setError(err.message || t('Invalid UPI QR'))
    }
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

      if (personal) {
        // GPay: native opens payee (no amount) — paste is unreliable in GPay.
        // PhonePe/Paytm: copies UPI ID for paste.
        suppressResumeLock(15 * 60_000)
        await copyVpaAndOpenApp({ pa: cleanPa, amount: am, pn: name, app: appId })
        addPendingP2pPay({
          pa: cleanPa,
          pn: name,
          amount: Number(am),
          personal: true,
        })
        // Ask SMS if needed so late bank SMS can auto-confirm
        if (isSmsPaySupported()) {
          const perm = await checkSmsPermission()
          if (!perm?.granted) await requestSmsPermission().catch(() => {})
        }
        if (appId === 'gpay') {
          setHint(t('GPay should open this UPI ID — type ₹') + am + t(' in GPay, then pay. Status waits for bank SMS (can be 5–15 min late).'))
        } else {
          setHint(t('UPI ID copied. Paste in app, type ₹') + am + t('. We hold this as Pending until bank SMS confirms.'))
        }
      } else {
        suppressResumeLock(10 * 60_000)
        const built = buildUpiPayLink({
          pa: cleanPa,
          am,
          pn: name,
          tn,
          includeName: true,
          merchant: true,
          mc,
        })
        await openUpiPayLink(built.link, {
          pa: built.pa,
          amount: built.amount,
          pn: name,
          merchant: true,
          mc,
          app: appId,
        })
        setHint(t('Opened UPI app with merchant payment link.'))
      }
    } catch (err) {
      setError(err?.message || t('Could not open UPI app'))
    } finally {
      setPaying(null)
    }
  }

  async function saveQrWithAmount() {
    setError('')
    const cleanPa = normalizeVpa(pa)
    const amErr = validateUpiAmount(amount)
    if (!cleanPa || amErr) {
      setError(amErr || t('Enter a valid UPI ID'))
      return
    }
    setQrBusy(true)
    try {
      await savePayQrToGallery({
        pa: cleanPa,
        am: formatUpiAmount(amount),
        pn: name,
      })
      setHint(t('QR saved to Gallery (with amount). Open GPay → Scan → choose from gallery.'))
    } catch (err) {
      setError(err?.message || t('Could not save QR'))
    } finally {
      setQrBusy(false)
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
        {t('Scan any UPI QR (shop or person). Merchant pays with link; personal uses copy ID or gallery QR.')}
      </p>

      {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      {hint && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 p-2 rounded">{hint}</div>}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={handleScan}
          disabled={scanBusy || scanning || !isNativePlatform()}
          className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {scanBusy || scanning ? t('Scanning…') : t('Scan QR')}
        </button>
      </div>
      {!isNativePlatform() && (
        <p className="text-xs text-amber-600 mb-3">{t('Camera scan needs the Android app. On web, paste the UPI link from the QR.')}</p>
      )}

      <form onSubmit={handlePasteParse} className="mb-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">{t('Paste UPI QR / link')}</label>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={2}
          placeholder="upi://pay?pa=shop@okbizaxis&pn=Shop&mc=5411&am=120.00"
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
        />
        <button type="submit" className="bg-slate-800 text-white rounded-md px-3 py-2 text-sm font-medium">
          {t('Parse')}
        </button>
      </form>

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
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${personal ? 'bg-teal/15 text-teal' : 'bg-brand-50 text-brand-700'}`}>
            {personal ? t('Private UPI') : t('Merchant')}
            {scanned ? ` · ${t('From QR')}` : ''}
          </span>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={!personal}
              onChange={(e) => setPersonal(!e.target.checked)}
            />
            {t('Merchant / shop QR')}
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('Name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Payee / shop name')}
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
        {(mc || tn) && (
          <div className="text-xs text-slate-500 space-y-0.5">
            {mc ? <div>MCC {mc}</div> : null}
            {tn ? <div>{t('Note')}: {tn}</div> : null}
          </div>
        )}
      </div>

      <div className="text-sm font-medium text-slate-700 mb-2">{t('Pay with')}</div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            disabled={!!paying || qrBusy}
            onClick={() => payWith(app.id)}
            className={`rounded-md py-3 px-3 font-semibold disabled:opacity-60 flex items-center justify-center gap-2 ${app.className}`}
          >
            {app.logo}
            <span>{paying === app.id ? t('Opening…') : app.label}</span>
          </button>
        ))}
      </div>

      {personal && (
        <button
          type="button"
          disabled={qrBusy || !!paying}
          onClick={saveQrWithAmount}
          className="w-full mb-2 border border-dashed border-slate-400 rounded-md py-3 text-sm font-medium disabled:opacity-60"
        >
          {qrBusy ? t('Saving QR…') : t('Save pay QR to gallery (keeps amount)')}
        </button>
      )}

      {personal && (
        <button
          type="button"
          onClick={() => navigate('/pending-pays')}
          className="w-full mb-2 text-sm text-brand-400 font-medium py-2"
        >
          {t('View pending pays (SMS status)')} →
        </button>
      )}

      <p className="text-xs text-slate-500 leading-relaxed">
        {personal
          ? t('GPay opens the UPI ID (you enter amount there). P2P status waits for bank SMS — even if SMS is 5–15 min late. Open Pending pays to see Waiting / Paid.')
          : t('Merchant: we open the UPI app with the payment link (amount already filled).')}
      </p>
    </div>
  )
}
