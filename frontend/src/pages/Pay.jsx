import { useEffect, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { useLanguage } from '../context/LanguageContext.jsx'
import { isNativePlatform } from '../nativePush.js'
import client from '../api/client'
import QrScannerOverlay from '../components/QrScannerOverlay.jsx'
import BillScanSheet from '../components/BillScanSheet.jsx'
import { isBillOcrSupported } from '../utils/billScan.js'
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
  resolveCategoryId,
  categoryNameForMcc,
  rememberMerchantCategoryId,
} from '../utils/upiQr.js'
import { upsertSavedPayee, findPayeeByPa, rememberPayeeCategory } from '../utils/savedPayees.js'
import { rememberLastPayAttempt } from '../utils/paymentNotify.js'
import { addPendingP2pPay } from '../utils/pendingP2pPays.js'
import { requestSmsPermission, isSmsPaySupported, checkSmsPermission } from '../utils/smsPayWatch.js'
import { useNavigate } from 'react-router-dom'
import { suppressResumeLock, savePendingUpiConfirm } from '../appLock.js'
import CategoryPicker from '../components/CategoryPicker.jsx'
import { detectMerchantBrand } from '../utils/subscriptionBrands.jsx'
import { findFoodCategoryId, suggestFoodCategoryName } from '../utils/foodCategory.js'

/** Payment apps. GPay hidden for P2P (unreliable); PhonePe / Paytm / BHIM work. */
const APPS = [
  {
    id: 'gpay',
    label: 'GPay',
    p2p: false,
    logoBg: 'bg-white ring-1 ring-slate-600/40',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden>
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
    p2p: true,
    logoBg: 'bg-[#5f259f]',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#5f259f" />
        <text
          x="12"
          y="16.5"
          textAnchor="middle"
          fill="#fff"
          fontSize="13"
          fontWeight="700"
          fontFamily="'Noto Sans Devanagari', 'Mangal', 'Nirmala UI', sans-serif"
        >
          पे
        </text>
      </svg>
    ),
  },
  {
    id: 'paytm',
    label: 'Paytm',
    p2p: true,
    logoBg: 'bg-[#00BAF2]',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden>
        <rect width="24" height="24" rx="6" fill="#00BAF2" />
        <text
          x="12"
          y="15.2"
          textAnchor="middle"
          fill="#fff"
          fontSize="7.2"
          fontWeight="800"
          fontFamily="Arial,sans-serif"
          letterSpacing="-0.5"
        >
          Paytm
        </text>
      </svg>
    ),
  },
  {
    id: 'bhim',
    label: 'BHIM',
    p2p: true,
    logoBg: 'bg-[#FF6F00]',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden>
        <rect width="24" height="24" rx="6" fill="#FF6F00" />
        <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="Arial,sans-serif">UPI</text>
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
  const [scanning, setScanning] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [billScanOpen, setBillScanOpen] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [defaultAccountId, setDefaultAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    Promise.all([client.get('/accounts'), client.get('/categories')])
      .then(([a, c]) => {
        const accs = a.data || []
        setAccounts(accs)
        setCategories(c.data || [])
        const primary = accs.find((x) => x.isPrimary) || accs[0]
        if (primary) setDefaultAccountId(String(primary.id))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!scanning) return undefined
    let handle = null
    CapApp.addListener('backButton', () => { handleCancelScan() }).then((h) => { handle = h })
    return () => { handle?.remove() }
  }, [scanning])

  function applyParsed(parsed) {
    const isP2p = parsed.personal ?? isPersonalUpi(parsed.mc)
    const brand = detectMerchantBrand(parsed.pn, parsed.pa, parsed.raw, parsed.tn)
    const known = findPayeeByPa(parsed.pa)
    // Prefer this UPI ID's remembered name (what we last saved, or what the user corrected
    // it to) over the QR's own embedded name — same UPI ID scanned again should fill in
    // exactly what we already know about this merchant/person.
    const merchantName = brand?.name || known?.pn || parsed.pn || ''
    setPa(parsed.pa || '')
    setName(merchantName)
    setMc(parsed.mc || '')
    setTn(parsed.tn || '')
    // Description = merchant/note only — never put UPI ID here (Payment ID field)
    setNote(isP2p ? (parsed.tn || '') : (parsed.tn || merchantName || ''))
    setPersonal(isP2p)
    if (parsed.am) setAmount(formatUpiAmount(parsed.am))

    let nextCat = ''
    if (known?.categoryId) {
      nextCat = String(known.categoryId)
    } else {
      nextCat = resolveCategoryId(categories, {
        pa: parsed.pa,
        mc: parsed.mc,
        personal: isP2p,
      })
    }
    // Brand → coffee/chai → Drinks (overrides generic QSR MCC); burger → Snacks if empty
    if (brand && !isP2p) {
      const brandText = `${brand.id} ${brand.name} ${(brand.keywords || []).join(' ')}`
      const want = suggestFoodCategoryName(brandText)
      const foodId = findFoodCategoryId(categories, brandText)
      if (foodId && (!nextCat || want === 'Drinks')) nextCat = foodId
    }
    if (nextCat) {
      setCategoryId(nextCat)
      if (!isP2p) rememberMerchantCategoryId(parsed.pa, nextCat)
    }

    setScanned(true)
    const mccHint = categoryNameForMcc(parsed.mc)
    setHint(
      isP2p
        ? t('Personal QR scanned. Fill category, then pay — we won’t ask again after.')
        : (
          mccHint
            ? `${t('Merchant QR')}: ${merchantName || parsed.pa} · ${mccHint}. ${t('Category filled — edit if needed.')}`
            : t('Merchant QR scanned. Name & type filled — confirm category + amount, then pay.')
        ),
    )
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
    if (!categoryId) {
      setError(t('Select a category before paying'))
      return
    }
    const am = formatUpiAmount(amount)
    const cat = categories.find((c) => String(c.id) === String(categoryId))
    const payNote = String(note || tn || '').trim()
    // Human description only — Payment ID is the UPI VPA (cleanPa)
    const humanDesc = payNote || String(name || '').trim() || (personal ? 'UPI payment' : 'Merchant payment')
    setPaying(appId)
    try {
      upsertSavedPayee({ pa: cleanPa, pn: name, categoryId, categoryName: cat?.name })
      rememberPayeeCategory(cleanPa, categoryId, cat?.name)
      if (!personal) rememberMerchantCategoryId(cleanPa, categoryId)
      rememberLastPayAttempt({
        pa: cleanPa,
        pn: name,
        amount: am,
        categoryId,
        description: humanDesc,
      })

      const pendingPayload = {
        pa: cleanPa,
        pn: name,
        amount: Number(am),
        categoryId,
        description: humanDesc,
        paymentId: cleanPa,
      }

      if (personal) {
        // GPay: native opens payee (no amount) — paste is unreliable in GPay.
        // PhonePe/Paytm: copies UPI ID for paste.
        suppressResumeLock(15 * 60_000)
        await copyVpaAndOpenApp({ pa: cleanPa, amount: am, pn: name, app: appId })
        addPendingP2pPay({ ...pendingPayload, personal: true })
        // Global "Did you pay?" if SMS is late / missed
        savePendingUpiConfirm({
          kind: 'p2p',
          pa: cleanPa,
          pn: name,
          am,
          amount: Number(am),
          categoryId,
          description: humanDesc,
          name,
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
          tn: payNote || tn,
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
        // Same pending + SMS → Transactions path as P2P
        addPendingP2pPay({ ...pendingPayload, personal: false })
        savePendingUpiConfirm({
          kind: 'scan_pay',
          pa: cleanPa,
          pn: name,
          am,
          amount: Number(am),
          categoryId,
          description: humanDesc,
          name,
        })
        if (isSmsPaySupported()) {
          const perm = await checkSmsPermission()
          if (!perm?.granted) await requestSmsPermission().catch(() => {})
        }
        setHint(t('Opened merchant pay link. Waiting for bank SMS to save it in Transactions (SMS can be late).'))
      }
    } catch (err) {
      setError(err?.message || t('Could not open UPI app'))
    } finally {
      setPaying(null)
    }
  }

  async function saveBillScan(data) {
    await client.post('/transactions', {
      accountId: data.accountId,
      categoryId: data.categoryId || null,
      type: 'EXPENSE',
      amount: data.amount,
      description: data.description,
      merchantName: data.merchant || null,
      txnDate: data.txnDate,
    })
    try {
      const { tryConfirmMatchingDues } = await import('../utils/matchDueSms.js')
      await tryConfirmMatchingDues({
        amount: data.amount,
        merchant: data.merchant || data.description,
        raw: data.description || '',
        allowUniqueAmount: true,
      })
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('mm-transactions-changed'))
    setHint(t('Bill saved to Transactions'))
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
          className="inline-flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60 min-h-[2.75rem]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect width="5" height="5" x="3" y="3" rx="1" />
            <rect width="5" height="5" x="16" y="3" rx="1" />
            <rect width="5" height="5" x="3" y="16" rx="1" />
            <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
            <path d="M21 21v.01" />
            <path d="M12 7v3a2 2 0 0 1-2 2H7" />
          </svg>
          {scanBusy || scanning ? t('Scanning…') : t('Scan QR')}
        </button>
        {isBillOcrSupported() && (
          <button
            type="button"
            onClick={() => setBillScanOpen(true)}
            disabled={scanning}
            className="inline-flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60 min-h-[2.75rem]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {t('Scan bill')}
          </button>
        )}
      </div>

      <BillScanSheet
        open={billScanOpen}
        onClose={() => setBillScanOpen(false)}
        accounts={accounts}
        categories={categories}
        defaultAccountId={defaultAccountId}
        onSave={saveBillScan}
      />
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
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('Payment ID')}</label>
          <input
            type="text"
            value={pa}
            onChange={(e) => setPa(e.target.value.trim())}
            placeholder="name@okicici"
            autoCapitalize="off"
            autoCorrect="off"
            className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-sm"
          />
          <p className="text-[11px] text-slate-500 mt-1">{t('UPI ID stays here — not in Description.')}</p>
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
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('Category')} <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-1.5">
            {t('Food tip: Drinks = coffee, chai, juice · Snacks = breakfast, burger, chaat · Dining Out = lunch/dinner/restaurant · Groceries = home cooking.')}
          </p>
          {addingCategory ? (
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const nameTrim = newCategoryName.trim()
                  if (!nameTrim) return
                  try {
                    const existing = categories.find((c) => String(c.name).toLowerCase() === nameTrim.toLowerCase())
                    if (existing) {
                      setCategoryId(String(existing.id))
                      setNewCategoryName('')
                      setAddingCategory(false)
                      return
                    }
                    const { data } = await client.post('/categories', { name: nameTrim, essential: false })
                    setCategories((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]))
                    setCategoryId(String(data.id))
                    setNewCategoryName('')
                    setAddingCategory(false)
                  } catch (err) {
                    setError(err.response?.data?.message || err.message || t('Could not add category'))
                  }
                }}
                placeholder={t('e.g. Drinks, Snacks, Dining Out')}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-md bg-brand-600 text-white text-sm font-medium"
                onClick={async () => {
                  const nameTrim = newCategoryName.trim()
                  if (!nameTrim) return
                  try {
                    const existing = categories.find((c) => String(c.name).toLowerCase() === nameTrim.toLowerCase())
                    if (existing) {
                      setCategoryId(String(existing.id))
                      setNewCategoryName('')
                      setAddingCategory(false)
                      return
                    }
                    const { data } = await client.post('/categories', { name: nameTrim, essential: false })
                    setCategories((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]))
                    setCategoryId(String(data.id))
                    setNewCategoryName('')
                    setAddingCategory(false)
                  } catch (err) {
                    setError(err.response?.data?.message || err.message || t('Could not add category'))
                  }
                }}
              >
                {t('Add')}
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-md border border-slate-300 text-sm"
                onClick={() => { setAddingCategory(false); setNewCategoryName('') }}
              >
                {t('Cancel')}
              </button>
            </div>
          ) : (
            <>
              <CategoryPicker
                categories={categories.filter((c) => String(c.name).toLowerCase() !== 'salary')}
                value={categoryId}
                onChange={(id) => setCategoryId(id)}
                placeholder={t('Select category…')}
              />
              <button
                type="button"
                className="mt-1.5 text-xs text-brand-600 font-medium"
                onClick={() => setAddingCategory(true)}
              >
                {t('+ New category')}
              </button>
            </>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('Description')}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('e.g. Lunch alone, dinner with partner, Burger King')}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
          <p className="text-[11px] text-slate-500 mt-1">{t('Shop / what you paid for — not the UPI ID.')}</p>
        </div>
        {mc && (
          <div className="text-xs text-slate-500">MCC {mc}</div>
        )}
      </div>

      <div className="text-sm font-medium text-slate-700 mb-3">{t('Pay with')}</div>
      <div className="pay-app-row flex flex-wrap justify-center gap-5 mb-4">
        {APPS.filter((app) => !personal || app.p2p !== false).map((app) => (
          <button
            key={app.id}
            type="button"
            disabled={!!paying || qrBusy}
            onClick={() => payWith(app.id)}
            className="pay-app-btn disabled:opacity-50"
            aria-label={app.label}
          >
            <span className={`pay-app-icon ${app.logoBg}`}>
              {paying === app.id ? (
                <span className="text-[10px] font-semibold text-slate-500 animate-pulse">…</span>
              ) : (
                app.logo
              )}
            </span>
            <span className="pay-app-label">{app.label}</span>
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
          ? t('P2P: use PhonePe / Paytm / BHIM (GPay hidden — unreliable for personal UPI). Status waits for bank SMS.')
          : t('Merchant: we open the UPI app with the payment link (amount already filled).')}
      </p>
    </div>
  )
}
