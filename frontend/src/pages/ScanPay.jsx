import { useEffect, useRef, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import { isNativePlatform } from '../nativePush.js'
import { suppressResumeLock } from '../appLock.js'
import QrScannerOverlay from '../components/QrScannerOverlay.jsx'
import { scanUpiQrNative, cancelUpiQrScan } from '../utils/scanUpiQr.js'
import {
  parseUpiQr,
  buildUpiPayLink,
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
  cu: 'INR',
  tn: '',
  personal: false,
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
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [logging, setLogging] = useState(false)
  const [loggedOk, setLoggedOk] = useState(false)
  const awaitingReturnRef = useRef(false)
  const categoriesRef = useRef([])

  useEffect(() => {
    categoriesRef.current = categories
  }, [categories])

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
      if (awaitingReturnRef.current && form.pa) {
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
  }, [form.pa])

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
      cu: parsed.cu || 'INR',
      tn: parsed.tn,
      personal: hintPersonal,
      sharedCategoryName,
      categoryId,
      description,
    }))
  }

  async function handleScan() {
    setError('')
    setScanning(true)
    setTorchOn(true)
    setTorchAvailable(false)
    try {
      const raw = await scanUpiQrNative({
        onTorchAvailable: (ok) => {
          setTorchAvailable(ok)
          setTorchOn(!!ok)
        },
      })
      await applyParsed(parseUpiQr(raw))
    } catch (err) {
      const msg = err?.message || String(err)
      if (!/cancel/i.test(msg)) setError(msg)
    } finally {
      setScanning(false)
      setTorchOn(false)
      setTorchAvailable(false)
    }
  }

  async function handleCancelScan() {
    await cancelUpiQrScan()
    setScanning(false)
    setTorchOn(false)
    setTorchAvailable(false)
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

  function openPay() {
    setError('')
    setLoggedOk(false)
    if (!form.pa) {
      setError(t('Scan a UPI QR first'))
      return
    }
    if (!form.am || Number(form.am) <= 0) {
      setError(t('Enter amount before paying'))
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
    const link = buildUpiPayLink({
      pa: form.pa,
      pn: form.pn || form.description,
      am: form.am,
      cu: form.cu,
      mc: form.personal ? undefined : form.mc,
      tn: form.tn || form.description,
    })
    awaitingReturnRef.current = true
    // GPay/PhonePe also backgrounds the app — don't re-lock on return from pay.
    suppressResumeLock(120_000)
    window.location.href = link
    if (!isNativePlatform()) {
      setTimeout(() => {
        if (awaitingReturnRef.current) {
          awaitingReturnRef.current = false
          setConfirmOpen(true)
        }
      }, 1500)
    }
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
    setLogging(true)
    setError('')
    try {
      await client.post('/transactions', {
        accountId: Number(form.accountId),
        categoryId: Number(form.categoryId),
        type: 'EXPENSE',
        amount: Number(form.am),
        description: form.description || form.pn || form.pa,
        txnDate: new Date().toISOString().slice(0, 10),
      })
      // Shared DB so any other user scanning this UPI ID gets the same category
      await saveUpiHint().catch(() => {})
      rememberMerchantCategoryId(form.pa, form.categoryId)
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
        torchOn={torchOn}
        torchAvailable={torchAvailable}
        onTorchChange={setTorchOn}
        onCancel={handleCancelScan}
        t={t}
      />

      <h1 className="text-2xl font-bold mb-2">{t('Scan & Pay')}</h1>
      <p className="text-sm text-slate-500 mb-6">
        {t('Scan a UPI QR, check details, pay in GPay/PhonePe, then confirm to log the expense.')}
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
              <span className="text-xs text-slate-500">{titleLabel}</span>
              {form.personal && (
                <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
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
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              value={form.am}
              onChange={(e) => setForm((f) => ({ ...f, am: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Description')}</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            >
              <option value="">{t('Select…')}</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {form.personal && (
              <p className="text-xs text-slate-500 mt-1">
                {t('Your choice is saved to the server for this UPI ID so others get it next time.')}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={openPay}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-3 font-semibold"
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

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={skipLog} />
          <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl m-0 sm:m-4">
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
