import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'
import { suppressResumeLock } from '../appLock.js'
import {
  isBillOcrSupported,
  scanBillFromFile,
  checkBillPaidInSms,
} from '../utils/billScan.js'
import { requestSmsPermission, isSmsPaySupported } from '../utils/smsPayWatch.js'
import Field from './Field.jsx'

/**
 * Camera / gallery bill upload → OCR fields → SMS paid check → save callback.
 */
export default function BillScanSheet({
  open,
  onClose,
  accounts = [],
  categories = [],
  defaultAccountId = '',
  onSave,
}) {
  const { t } = useLanguage()
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [categoryId, setCategoryId] = useState('')
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [smsStatus, setSmsStatus] = useState(null)
  const [step, setStep] = useState('pick') // pick | review

  useEffect(() => {
    if (!open) return
    setBusy(false)
    setError('')
    setPreview('')
    setAmount('')
    setMerchant('')
    setPaymentMode('UPI')
    setAccountId(defaultAccountId || '')
    setCategoryId('')
    setTxnDate(new Date().toISOString().slice(0, 10))
    setDescription('')
    setSmsStatus(null)
    setStep('pick')
  }, [open, defaultAccountId])

  if (!open) return null

  async function onPickedFile(file) {
    if (!file) return
    if (!isBillOcrSupported()) {
      setError(t('Bill scan needs the Android app'))
      return
    }
    setBusy(true)
    setError('')
    setSmsStatus(null)
    try {
      const result = await scanBillFromFile(file, { categories })
      setPreview(result.previewDataUrl || '')
      setAmount(result.amount || '')
      setMerchant(result.merchant || '')
      setPaymentMode(result.paymentMode?.label || 'Other')
      if (result.categoryId) setCategoryId(String(result.categoryId))
      if (result.txnDate) setTxnDate(result.txnDate)
      const desc = [
        result.merchant || t('Bill'),
        result.paymentMode?.label && `via ${result.paymentMode.label}`,
        'from bill photo',
      ].filter(Boolean).join(' · ')
      setDescription(desc.slice(0, 200))
      setStep('review')

      // SMS check before user saves
      if (result.amount) {
        let sms = await checkBillPaidInSms({
          amount: result.amount,
          merchant: result.merchant,
        })
        if (!sms.checked && sms.reason === 'sms_permission' && isSmsPaySupported()) {
          await requestSmsPermission().catch(() => {})
          sms = await checkBillPaidInSms({
            amount: result.amount,
            merchant: result.merchant,
          })
        }
        setSmsStatus(sms)
      }
    } catch (err) {
      setError(err?.message || t('Could not read bill'))
      setStep('pick')
    } finally {
      setBusy(false)
    }
  }

  function pickCamera() {
    suppressResumeLock(5 * 60_000)
    cameraRef.current?.click()
  }

  function pickGallery() {
    suppressResumeLock(5 * 60_000)
    galleryRef.current?.click()
  }

  async function recheckSms() {
    if (!amount) return
    setBusy(true)
    try {
      if (isSmsPaySupported()) await requestSmsPermission().catch(() => {})
      const sms = await checkBillPaidInSms({ amount, merchant })
      setSmsStatus(sms)
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!accountId || !amount || Number(amount) < 1) {
      setError(t('Enter amount and account'))
      return
    }
    setBusy(true)
    setError('')
    try {
      // Final SMS check right before save
      let sms = smsStatus
      if (!sms?.matched) {
        sms = await checkBillPaidInSms({ amount, merchant })
        setSmsStatus(sms)
      }
      await onSave?.({
        accountId: Number(accountId),
        categoryId: categoryId ? Number(categoryId) : null,
        type: 'EXPENSE',
        amount: Number(amount),
        description: description || `${merchant || 'Bill'} · via ${paymentMode}`,
        txnDate,
        paymentMode,
        merchant,
        smsMatched: !!sms?.matched,
        sms,
      })
      onClose?.()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || t('Save failed'))
    } finally {
      setBusy(false)
    }
  }

  function smsBanner() {
    if (!smsStatus) return null
    if (!smsStatus.checked && smsStatus.reason === 'sms_permission') {
      return (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          {t('Enable SMS to verify this bill was paid.')}
          <button type="button" onClick={recheckSms} className="block mt-1 text-brand-600 font-semibold text-xs">
            {t('Check SMS now')}
          </button>
        </div>
      )
    }
    if (smsStatus.matched) {
      return (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          {t('SMS found — bill amount matches a bank debit.')}
          {smsStatus.sms?.payeeName ? ` (${smsStatus.sms.payeeName})` : ''}
          {smsStatus.merchantHit ? ` · ${t('merchant match')}` : ''}
        </div>
      )
    }
    if (smsStatus.checked && !smsStatus.matched) {
      return (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          {t('No matching paid SMS yet. You can still save, or wait and re-check.')}
          <button type="button" onClick={recheckSms} className="block mt-1 text-brand-600 font-semibold text-xs">
            {t('Check SMS again')}
          </button>
        </div>
      )
    }
    return null
  }

  return (
    <div className="fixed inset-0 z-[67] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={() => !busy && onClose?.()} />
      <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl m-0 sm:m-4 max-h-[92vh] overflow-y-auto">
        <h2 className="font-bold text-lg mb-1">{t('Scan bill')}</h2>
        <p className="text-sm text-slate-600 mb-4">
          {t('Photo or upload a bill — we read amount, category, payment mode, then check SMS before save.')}
        </p>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPickedFile(e.target.files?.[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickedFile(e.target.files?.[0])}
        />

        {step === 'pick' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={pickCamera}
              className="w-full bg-brand-600 text-white rounded-md py-3 font-semibold disabled:opacity-60"
            >
              {busy ? t('Reading bill…') : t('Take photo')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={pickGallery}
              className="w-full border border-slate-300 rounded-md py-3 font-medium disabled:opacity-60"
            >
              {t('Upload from gallery')}
            </button>
            <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 py-2">
              {t('Cancel')}
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="flex flex-col gap-3">
            {preview && (
              <img src={preview} alt="" className="w-full max-h-40 object-contain rounded-xl bg-slate-50 border border-slate-100" />
            )}
            {smsBanner()}

            <Field label={t('Amount')}>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full" required />
            </Field>
            <Field label={t('Merchant / shop')}>
              <input value={merchant} onChange={(e) => setMerchant(e.target.value)} className="w-full" placeholder={t('Shop name')} />
            </Field>
            <Field label={t('Payment mode')}>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full">
                {['UPI', 'Card', 'Cash', 'Net banking', 'Wallet', 'Other'].map((m) => (
                  <option key={m} value={m}>{t(m)}</option>
                ))}
              </select>
            </Field>
            <Field label={t('Account')}>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full" required>
                <option value="">{t('Account...')}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label={t('Category')}>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full">
                <option value="">{t('No category')}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label={t('Date')}>
              <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} className="w-full" />
            </Field>
            <Field label={t('Description')}>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full" />
            </Field>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={save}
                className="flex-1 bg-brand-600 text-white rounded-md py-2.5 font-medium disabled:opacity-60"
              >
                {busy ? t('Saving…') : t('Save to Transactions')}
              </button>
              <button type="button" disabled={busy} onClick={() => setStep('pick')} className="px-3 py-2.5 border border-slate-300 rounded-md text-sm">
                {t('Retake')}
              </button>
            </div>
            {!smsStatus?.matched && (
              <p className="text-[11px] text-slate-500 text-center">
                {t('If SMS has not arrived yet, re-check SMS, then save.')}
              </p>
            )}
          </div>
        )}

        {error && step === 'pick' && <div className="text-sm text-red-600 mt-3">{error}</div>}
      </div>
    </div>
  )
}
