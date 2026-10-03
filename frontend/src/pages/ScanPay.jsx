import { useEffect, useRef, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import { isNativePlatform } from '../nativePush.js'
import { suppressResumeLock, savePendingUpiConfirm, readPendingUpiConfirm, clearPendingUpiConfirm } from '../appLock.js'
import QrScannerOverlay from '../components/QrScannerOverlay.jsx'
import { scanUpiQrNative, cancelUpiQrScan } from '../utils/scanUpiQr.js'
import {
  parseUpiQr,
  buildUpiPayLink,
  openUpiPayLink,
  copyUpiPayLink,
  copyVpaAndOpenApp,
  savePayQrToGallery,
  makePayQrDataUrl,
  validateUpiAmount,
  formatUpiAmount,
  resolveCategoryId,
  rememberMerchantCategoryId,
  categoryNameForMcc,
  isPersonalUpi,
} from '../utils/upiQr.js'

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    if (a.name === 'Other') return 1
    if (b.name === 'Other') return -1
    return a.name.localeCompare(b.name)
  })
}

const empty = {
  pa: '',
  pn: '',
  mc: '',
  am: '',
  mam: '',
  cu: 'INR',
  tn: '',
  personal: false,
  raw: '',
  accountId: '',
  categoryId: '',
  description: '',
  sharedCategoryName: '',
}

export default function ScanPay() {
  const { t } = useLanguage()
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(empty)
  const [paste, setPaste] = useState('')
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [payPreview, setPayPreview] = useState(null) // { link, pa, amount, name, personal, qrDataUrl }
  const [paying, setPaying] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)
  const [logging, setLogging] = useState(false)
  const [loggedOk, setLoggedOk] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const awaitingReturnRef = useRef(false)
  const categoriesRef = useRef([])

  useEffect(() => {
    categoriesRef.current = categories
  }, [categories])

  // Restore "Did you pay?" after returning from GPay (WebView may have remounted).
  useEffect(() => {
    const pending = readPendingUpiConfirm()
    if (!pending) return
    setForm((f) => ({
      ...f,
      pa: pending.pa || '',
      pn: pending.pn || '',
      mc: pending.mc || '',
      am: pending.am || '',
      mam: pending.mam || '',
      cu: pending.cu || 'INR',
      tn: pending.tn || '',
      personal: !!pending.personal,
      raw: pending.raw || '',
      accountId: pending.accountId ? String(pending.accountId) : f.accountId,
      categoryId: pending.categoryId ? String(pending.categoryId) : '',
      description: pending.description || '',
      sharedCategoryName: pending.sharedCategoryName || '',
    }))
    setConfirmOpen(true)
    awaitingReturnRef.current = false
  }, [])

  useEffect(() => {
    Promise.all([client.get('/accounts'), client.get('/categories')]).then(([accRes, catRes]) => {
      setAccounts(accRes.data)
      setCategories(catRes.data)
      const primary = accRes.data.find((a) => a.isPrimary) || accRes.data[0]
      if (primary) setForm((f) => (f.accountId ? f : { ...f, accountId: String(primary.id) }))
    }).catch((err) => setError(err.response?.data?.message || t('Failed to load')))
  }, [t])

  useEffect(() => {
    if (!form.pa || !categories.length || form.categoryId) return
    const categoryId = resolveCategoryId(categories, {
      pa: form.pa,
      mc: form.mc,
      personal: form.personal,
      sharedCategoryName: form.sharedCategoryName,
    })
    if (categoryId) setForm((f) => ({ ...f, categoryId }))
  }, [categories, form.pa, form.mc, form.personal, form.sharedCategoryName, form.categoryId])

  useEffect(() => {
    const showConfirmIfNeeded = () => {
      if (awaitingReturnRef.current || readPendingUpiConfirm()) {
        awaitingReturnRef.current = false
        setConfirmOpen(true)
      }
    }
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) showConfirmIfNeeded()
    })
    const onVis = () => {
      if (document.visibilityState === 'visible') showConfirmIfNeeded()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      sub.then((h) => h.remove())
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // Android hardware back must close the scanner — otherwise the camera stays up
  // with the app chrome still hidden (barcode-scanner-active).
  useEffect(() => {
    if (!scanning) return undefined
    let handle = null
    CapApp.addListener('backButton', () => {
      handleCancelScan()
    }).then((h) => { handle = h })
    return () => {
      handle?.remove()
    }
  }, [scanning])

  async function applyParsed(parsed) {
    setError('')
    setLoggedOk(false)
    setConfirmOpen(false)

    const personal = parsed.personal ?? isPersonalUpi(parsed.mc)
    let sharedCategoryName = ''
    let hintPersonal = personal

    try {
      const { data } = await client.get('/upi-hints', { params: { upiId: parsed.pa } })
      sharedCategoryName = data.categoryName || ''
      // DB may already know this VPA is personal even if MCC was weird
      if (typeof data.personal === 'boolean') hintPersonal = data.personal || personal
    } catch {
      // 404 = first time seeing this UPI ID — fine
    }

    const cats = categoriesRef.current
    const categoryId = resolveCategoryId(cats, {
      pa: parsed.pa,
      mc: parsed.mc,
      personal: hintPersonal,
      sharedCategoryName,
    })

    // Private UPI: show username tag (pn), not "merchant"
    const description = hintPersonal
      ? (parsed.pn || parsed.pa)
      : (parsed.pn || parsed.tn || parsed.pa)

    setForm((f) => ({
      ...f,
      pa: parsed.pa,
      pn: parsed.pn,
      mc: parsed.mc,
      am: parsed.am || '',
      mam: parsed.mam || '',
      cu: parsed.cu || 'INR',
      tn: parsed.tn,
      personal: hintPersonal,
      raw: parsed.raw || '',
      sharedCategoryName,
      categoryId,
      description,
    }))
  }

  async function handleScan() {
    setError('')
    setScanning(true)
    setCameraReady(false)
    setTorchOn(false)
    setTorchAvailable(false)
    try {
      const raw = await scanUpiQrNative({
        onTorchAvailable: setTorchAvailable,
        onTorchChange: setTorchOn,
        onPreviewReady: () => setCameraReady(true),
      })
      await applyParsed(parseUpiQr(raw))
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
    // Restore UI first so Cancel/Back never leaves a stuck camera-only screen.
    setScanning(false)
    setCameraReady(false)
    setTorchOn(false)
    setTorchAvailable(false)
    try {
      await cancelUpiQrScan()
    } catch {
      // ignore — UI already closed
    }
  }

  async function handlePasteParse(e) {
    e.preventDefault()
    setError('')
    try {
      await applyParsed(parseUpiQr(paste))
    } catch (err) {
      setError(err.message || t('Invalid UPI QR'))
    }
  }

  function markAwaitingReturn(builtPa, builtAmount) {
    awaitingReturnRef.current = true
    suppressResumeLock(300_000)
    savePendingUpiConfirm({
      kind: 'scan_pay',
      pa: builtPa,
      pn: form.pn,
      mc: form.mc,
      am: builtAmount,
      cu: 'INR',
      tn: form.tn,
      personal: form.personal,
      raw: form.raw,
      accountId: form.accountId,
      categoryId: form.categoryId,
      description: form.description,
      sharedCategoryName: form.sharedCategoryName,
    })
  }

  /** Step 1: validate + show exact payee/amount. Never opens GPay yet. */
  async function openPay() {
    setError('')
    setLoggedOk(false)
    if (!form.pa) {
      setError(t('Scan a UPI QR first'))
      return
    }
    const amountError = validateUpiAmount(form.am, { mam: form.mam, raw: form.raw })
    if (amountError) {
      setError(amountError)
      return
    }
    if (!form.accountId) {
      setError(t('Pick an account'))
      return
    }
    if (!form.categoryId) {
      setError(t('Select a category'))
      return
    }
    try {
      const personal = !!form.personal
      const built = buildUpiPayLink({
        pa: form.pa,
        am: form.am,
        pn: form.pn || form.description,
        includeName: true,
        merchant: !personal,
        mc: form.mc,
      })
      setForm((f) => ({ ...f, am: built.amount, pa: built.pa }))
      let qrDataUrl = null
      if (personal) {
        try {
          const qr = await makePayQrDataUrl({
            pa: built.pa,
            am: built.amount,
            pn: form.pn || form.description,
          })
          qrDataUrl = qr.dataUrl
        } catch {
          // preview can continue without QR image
        }
      }
      setPayPreview({
        link: built.link,
        pa: built.pa,
        amount: built.amount,
        name: form.pn || form.description || built.pa,
        personal,
        qrDataUrl,
      })
    } catch (err) {
      setError(err.message || t('Could not build payment link'))
    }
  }

  /** Merchant only — deep-link into GPay / PhonePe. */
  async function confirmAndOpenUpi(app = null) {
    if (!payPreview?.pa || !payPreview?.amount || paying || payPreview.personal) return
    setPaying(true)
    setError('')
    try {
      const built = buildUpiPayLink({
        pa: payPreview.pa,
        am: payPreview.amount,
        pn: form.pn || form.description || payPreview.name,
        includeName: true,
        merchant: true,
        mc: form.mc,
      })
      markAwaitingReturn(built.pa, built.amount)
      await openUpiPayLink(built.link, {
        pa: built.pa,
        amount: built.amount,
        pn: form.pn || form.description || payPreview.name,
        merchant: true,
        mc: form.mc,
        app,
      })
      setPayPreview(null)
      if (!isNativePlatform()) {
        setTimeout(() => {
          if (awaitingReturnRef.current) {
            awaitingReturnRef.current = false
            setConfirmOpen(true)
          }
        }, 1500)
      }
    } catch (err) {
      awaitingReturnRef.current = false
      clearPendingUpiConfirm()
      setError(err?.message || t('Could not open UPI app'))
    } finally {
      setPaying(false)
    }
  }

  /** P2P — copy UPI ID and open app (manual-style pay). */
  async function confirmCopyAndOpen(app = null) {
    if (!payPreview?.pa || !payPreview?.amount || paying) return
    setPaying(true)
    setError('')
    try {
      markAwaitingReturn(payPreview.pa, payPreview.amount)
      await copyVpaAndOpenApp({
        pa: payPreview.pa,
        amount: payPreview.amount,
        app,
      })
      setPayPreview(null)
      if (!isNativePlatform()) {
        setTimeout(() => {
          if (awaitingReturnRef.current) {
            awaitingReturnRef.current = false
            setConfirmOpen(true)
          }
        }, 1500)
      }
    } catch (err) {
      awaitingReturnRef.current = false
      clearPendingUpiConfirm()
      setError(err?.message || t('Could not open UPI app'))
    } finally {
      setPaying(false)
    }
  }

  /** P2P — save amount QR to gallery; user scans it from GPay/PhonePe gallery. */
  async function confirmSavePayQr() {
    if (!payPreview?.pa || !payPreview?.amount || qrBusy) return
    setQrBusy(true)
    setError('')
    try {
      const result = await savePayQrToGallery({
        pa: payPreview.pa,
        am: payPreview.amount,
        pn: form.pn || form.description || payPreview.name,
      })
      if (result.dataUrl) {
        setPayPreview((p) => (p ? { ...p, qrDataUrl: result.dataUrl } : p))
      }
      markAwaitingReturn(payPreview.pa, payPreview.amount)
    } catch (err) {
      setError(err?.message || t('Could not save QR'))
    } finally {
      setQrBusy(false)
    }
  }

  async function copyPayLink() {
    if (!payPreview?.pa || !payPreview?.amount) return
    try {
      await copyUpiPayLink({ pa: payPreview.pa, amount: payPreview.amount })
      setError('')
    } catch (err) {
      setError(err?.message || t('Could not copy link'))
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    const { data } = await client.post('/categories', { name: newCategoryName.trim(), essential: false })
    setCategories((prev) => [...prev, data])
    setForm((f) => ({ ...f, categoryId: String(data.id) }))
    setNewCategoryName('')
    setAddingCategory(false)
  }

  async function saveUpiHint() {
    const cat = categories.find((c) => String(c.id) === String(form.categoryId))
    if (!cat) return
    await client.put('/upi-hints', {
      upiId: form.pa,
      categoryName: cat.name,
      personal: form.personal,
      displayName: form.pn || form.description || null,
    })
  }

  async function confirmPaid() {
    if (!form.categoryId) {
      setError(t('Select a category'))
      setConfirmOpen(false)
      return
    }
    const amount = formatUpiAmount(form.am)
    if (!amount) {
      setError(t('Invalid amount'))
      return
    }
    setLogging(true)
    setError('')
    try {
      await client.post('/transactions', {
        accountId: Number(form.accountId),
        categoryId: Number(form.categoryId),
        type: 'EXPENSE',
        amount: Number(amount),
        description: form.description || form.pn || form.pa,
        txnDate: new Date().toISOString().slice(0, 10),
      })
      await saveUpiHint().catch(() => {})
      rememberMerchantCategoryId(form.pa, form.categoryId)
      clearPendingUpiConfirm()
      setConfirmOpen(false)
      setLoggedOk(true)
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    } finally {
      setLogging(false)
    }
  }

  function skipLog() {
    setConfirmOpen(false)
    awaitingReturnRef.current = false
    clearPendingUpiConfirm()
  }

  const mccHint = categoryNameForMcc(form.mc)
  const expenseCategories = sortCategories(categories.filter((c) => c.name !== 'Salary'))
  const titleLabel = form.personal ? t('Private UPI') : t('Merchant')
  const nameLine = form.personal
    ? (form.pn || t('Unknown user'))
    : (form.pn || form.pa)

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

      <h1 className="text-2xl font-bold mb-2">{t('Scan & Pay')}</h1>
      <p className="page-sub">
        {t('Scan a UPI QR, check details, pay in any UPI app (PhonePe, GPay, Paytm…), then confirm to log the expense.')}
      </p>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      {loggedOk && (
        <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 p-2 rounded">
          {t('Expense logged.')}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {isNativePlatform() ? (
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {scanning ? t('Scanning…') : t('Scan QR')}
          </button>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded w-full">
            {t('Camera scan needs the Android app. On web, paste the UPI link from the QR.')}
          </p>
        )}
      </div>

      {!isNativePlatform() && (
        <form onSubmit={handlePasteParse} className="mb-6 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">{t('Paste UPI QR text')}</label>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={3}
            placeholder="upi://pay?pa=friend@upi&pn=Rahul&mc=0000&am=120"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
          />
          <button type="submit" className="bg-slate-800 text-white rounded-md px-3 py-2 text-sm font-medium">
            {t('Parse')}
          </button>
        </form>
      )}

      {form.pa && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={
                  form.personal
                    ? 'text-sm font-bold text-teal tracking-wide'
                    : 'text-xs text-slate-500'
                }
              >
                {titleLabel}
              </span>
              {form.personal && (
                <span className="text-[10px] uppercase tracking-wide bg-teal/15 text-teal px-2 py-0.5 rounded font-semibold">
                  {t('Not a merchant')}
                </span>
              )}
            </div>
            <div className="font-semibold text-lg">
              {form.personal ? (
                <>
                  <span className="text-slate-500 text-sm font-medium mr-1">{t('Username')}</span>
                  {nameLine}
                </>
              ) : (
                nameLine
              )}
            </div>
            <div className="text-sm text-slate-600 font-mono">{form.pa}</div>
            {form.personal ? (
              <div className="text-xs text-slate-500 mt-1">
                {t('MCC missing/0000 — pick a category; it will be saved for this UPI ID.')}
              </div>
            ) : form.mc ? (
              <div className="text-xs text-slate-500 mt-1">
                MCC {form.mc}{mccHint ? ` → ${mccHint}` : ''}
                {form.sharedCategoryName ? ` · ${t('Saved category')}: ${form.sharedCategoryName}` : ''}
              </div>
            ) : null}
            {form.personal && form.sharedCategoryName && (
              <div className="text-xs text-emerald-700 mt-1">
                {t('Category from shared history')}: {form.sharedCategoryName}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Amount')}</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={form.am}
              onChange={(e) => setForm((f) => ({ ...f, am: e.target.value.replace(/[^\d.]/g, '') }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Account')}</label>
            <select
              value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Category')}</label>
            {addingCategory ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  placeholder={t('New category name')}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory(e))}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md"
                />
                <button type="button" onClick={handleAddCategory} className="px-3 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium">{t('Add')}</button>
                <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryName('') }} className="px-3 py-2 rounded-md border border-slate-300 text-sm">{t('Cancel')}</button>
              </div>
            ) : (
              <select
                value={form.categoryId}
                onChange={(e) => {
                  const picked = categories.find((c) => String(c.id) === e.target.value)
                  if (picked?.name === 'Other') {
                    setAddingCategory(true)
                    setForm((f) => ({ ...f, categoryId: '' }))
                  } else {
                    setForm((f) => ({ ...f, categoryId: e.target.value }))
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                <option value="">{t('Select…')}</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name === 'Other' ? t('Other (add new)') : c.name}</option>
                ))}
              </select>
            )}
            {form.personal && (
              <p className="text-xs text-slate-500 mt-1">
                {t('Your choice is saved to the server for this UPI ID so others get it next time.')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Description / Note')}</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('e.g. Lunch, rent share, groceries…')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>

          <button
            type="button"
            onClick={openPay}
            disabled={paying}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-3 font-semibold disabled:opacity-60"
          >
            {t('Pay with UPI')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.categoryId) {
                setError(t('Select a category'))
                return
              }
              setConfirmOpen(true)
            }}
            className="w-full border border-slate-300 rounded-md py-2 text-sm text-slate-700"
          >
            {t('Already paid? Log expense')}
          </button>
        </div>
      )}

      {payPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20">
          <div className="absolute inset-0 bg-black/50" onClick={() => !paying && !qrBusy && setPayPreview(null)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl p-5 shadow-xl max-h-[min(88vh,100%)] overflow-y-auto">
            <h2 className="font-bold text-lg mb-1">{t('Confirm payment')}</h2>
            <p className="text-sm text-slate-500 mb-4">
              {payPreview.personal
                ? t('Personal UPI: use QR from gallery or copy ID (GPay links often fail).')
                : t('Merchant UPI: open any UPI app with the payment link.')}
            </p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 mb-4">
              <div className="text-xs text-slate-500">{t('Paying to')}</div>
              <div className="font-semibold text-base">{payPreview.name}</div>
              <div className="font-mono text-sm text-teal">{payPreview.pa}</div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm text-slate-500">{t('Amount')}</span>
                <span className="text-2xl font-bold text-emerald-600">
                  ₹{Number(payPreview.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {payPreview.personal && payPreview.qrDataUrl && (
                <div className="pt-3 border-t border-slate-200 flex flex-col items-center gap-2">
                  <img
                    src={payPreview.qrDataUrl}
                    alt="Pay QR"
                    className="w-44 h-44 rounded-lg bg-white border border-slate-200"
                  />
                  <p className="text-[11px] text-slate-500 text-center leading-snug">
                    {t('Save QR → GPay/PhonePe Scan → choose from gallery')}
                  </p>
                </div>
              )}
              {!payPreview.personal && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{t('UPI link (check amount)')}</div>
                  <div className="font-mono text-[11px] text-slate-400 break-all leading-snug">{payPreview.link}</div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {payPreview.personal ? (
                <>
                  <button
                    type="button"
                    disabled={qrBusy || paying}
                    onClick={confirmSavePayQr}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-3 font-semibold disabled:opacity-60"
                  >
                    {qrBusy ? t('Saving QR…') : t('Save pay QR to gallery')}
                  </button>
                  <button
                    type="button"
                    disabled={paying || qrBusy}
                    onClick={() => confirmCopyAndOpen('gpay')}
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-semibold disabled:opacity-60"
                  >
                    {paying ? t('Opening…') : t('Copy UPI ID & open GPay')}
                  </button>
                  <button
                    type="button"
                    disabled={paying || qrBusy}
                    onClick={() => confirmCopyAndOpen('phonepe')}
                    className="w-full border border-slate-300 rounded-md py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    {t('Copy UPI ID & open PhonePe')}
                  </button>
                  <button
                    type="button"
                    disabled={paying || qrBusy}
                    onClick={() => confirmCopyAndOpen(null)}
                    className="w-full border border-slate-300 rounded-md py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    {t('Copy UPI ID & open UPI app')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={paying}
                    onClick={() => confirmAndOpenUpi('gpay')}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-3 font-semibold disabled:opacity-60"
                  >
                    {paying ? t('Opening…') : t('Pay in GPay')}
                  </button>
                  <button
                    type="button"
                    disabled={paying}
                    onClick={() => confirmAndOpenUpi('phonepe')}
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-semibold disabled:opacity-60"
                  >
                    {t('Pay in PhonePe')}
                  </button>
                  <button
                    type="button"
                    disabled={paying}
                    onClick={() => confirmAndOpenUpi(null)}
                    className="w-full border border-slate-300 rounded-md py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    {t('Other UPI app…')}
                  </button>
                  <button
                    type="button"
                    disabled={paying}
                    onClick={copyPayLink}
                    className="w-full border border-dashed border-slate-400 rounded-md py-2.5 text-sm text-slate-500 disabled:opacity-60"
                  >
                    {t('Copy UPI link (test outside app)')}
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={paying || qrBusy}
                onClick={() => setPayPreview(null)}
                className="w-full py-2 text-sm text-slate-500"
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20">
          <div className="absolute inset-0 bg-black/40" onClick={skipLog} />
          <div className="relative bg-white w-full max-w-md rounded-2xl p-5 shadow-xl">
            <h2 className="font-bold text-lg mb-2">{t('Did you pay?')}</h2>
            <p className="text-sm text-slate-600 mb-4">
              {t('Log')} ₹{Number(form.am || 0).toLocaleString('en-IN')} {t('to')} {form.description || form.pn || form.pa}?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={logging}
                onClick={confirmPaid}
                className="flex-1 bg-brand-600 text-white rounded-md py-2.5 font-medium disabled:opacity-60"
              >
                {logging ? t('Saving…') : t('Yes, log it')}
              </button>
              <button type="button" onClick={skipLog} className="flex-1 border border-slate-300 rounded-md py-2.5">
                {t('Not yet')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
