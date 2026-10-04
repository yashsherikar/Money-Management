import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLanguage } from '../context/LanguageContext.jsx'
import {
  isBillOcrSupported,
  captureBillPhoto,
  pickBillPhoto,
  scanBillFromFile,
  checkBillPaidInSms,
} from '../utils/billScan.js'
import { requestSmsPermission, isSmsPaySupported } from '../utils/smsPayWatch.js'
import { suppressResumeLock } from '../appLock.js'
import Field from './Field.jsx'
import { useBodyScrollLock } from '../utils/useBodyScrollLock.js'
import ModalPortal from '../utils/ModalPortal.jsx'

/**
 * Native camera / gallery bill upload → OCR fields → SMS paid check → save callback.
 */
export default function BillScanSheet({
  open,
  onClose,
  accounts = [],
  categories = [],
  defaultAccountId = '',
  onSave,
}) {
  useBodyScrollLock(!!open)
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
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
    setBusyLabel('')
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

  async function applyScanResult(result) {
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
  }

  async function takePhoto() {
    setBusy(true)
    setBusyLabel(t('Opening camera…'))
    setError('')
    setSmsStatus(null)
    try {
      if (Capacitor.isNativePlatform()) {
        // Before camera: avoid app-lock biometric when returning from the photo screen
        suppressResumeLock(10 * 60_000)
        const result = await captureBillPhoto({
          categories,
          onPhase: (phase) => {
            if (phase === 'camera') setBusyLabel(t('Opening camera…'))
            else if (phase === 'ocr') setBusyLabel(t('Reading bill…'))
          },
        })
        suppressResumeLock(10 * 60_000)
        setBusyLabel(t('Checking SMS…'))
        await applyScanResult(result)
      } else {
        // Web fallback: file input with capture
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.capture = 'environment'
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) { setBusy(false); setBusyLabel(''); return }
          try {
            setBusyLabel(t('Reading bill…'))
            await applyScanResult(await scanBillFromFile(file, { categories }))
          } catch (err) {
            setError(err?.message || t('Could not read bill'))
            setStep('pick')
          } finally {
            setBusy(false)
            setBusyLabel('')
          }
        }
        input.click()
        return
      }
    } catch (err) {
      if (err?.message !== 'User cancelled photos app' && !/cancel/i.test(err?.message || '')) {
        setError(err?.message || t('Could not open camera'))
      }
      setStep('pick')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  async function uploadGallery() {
    setBusy(true)
    setBusyLabel(t('Opening gallery…'))
    setError('')
    setSmsStatus(null)
    try {
      if (Capacitor.isNativePlatform()) {
        suppressResumeLock(10 * 60_000)
        const result = await pickBillPhoto({
          categories,
          onPhase: (phase) => {
            if (phase === 'gallery') setBusyLabel(t('Opening gallery…'))
            else if (phase === 'ocr') setBusyLabel(t('Reading bill…'))
          },
        })
        suppressResumeLock(10 * 60_000)
        setBusyLabel(t('Checking SMS…'))
        await applyScanResult(result)
      } else {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) { setBusy(false); setBusyLabel(''); return }
          try {
            setBusyLabel(t('Reading bill…'))
            await applyScanResult(await scanBillFromFile(file, { categories }))
          } catch (err) {
            setError(err?.message || t('Could not read bill'))
            setStep('pick')
          } finally {
            setBusy(false)
            setBusyLabel('')
          }
        }
        input.click()
        return
      }
    } catch (err) {
      if (err?.message !== 'User cancelled photos app' && !/cancel/i.test(err?.message || '')) {
        setError(err?.message || t('Could not open gallery'))
      }
      setStep('pick')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
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
    <ModalPortal>
    <div className="app-modal" role="dialog" aria-modal="true">
      <div className="app-modal-backdrop" onClick={() => !busy && onClose?.()} />
      <div className="app-modal-panel">
        <div className="app-modal-body">
        <h2 className="font-bold text-lg mb-1">{t('Scan bill')}</h2>
        <p className="text-sm text-slate-600 mb-4">
          {t('Photo or upload a bill — we read amount, category, payment mode, then check SMS before save.')}
        </p>

        {step === 'pick' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy || !isBillOcrSupported()}
              onClick={takePhoto}
              className="w-full bg-brand-600 text-white rounded-md py-3 font-semibold disabled:opacity-60"
            >
              {busy ? (busyLabel || t('Reading bill…')) : t('Take photo')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={uploadGallery}
              className="w-full border border-slate-300 rounded-md py-3 font-medium disabled:opacity-60"
            >
              {busy ? (busyLabel || t('Reading bill…')) : t('Upload from gallery')}
            </button>
            {busy && (
              <div className="mt-1" role="status" aria-live="polite">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full w-1/3 bg-brand-500 animate-[loading-bar_1s_ease-in-out_infinite]" />
                </div>
                <p className="text-xs text-slate-500 text-center mt-2">{busyLabel || t('Reading bill…')}</p>
              </div>
            )}
            {!isBillOcrSupported() && (
              <p className="text-xs text-amber-600 text-center">
                {t('Bill scan needs the Android app')}
              </p>
            )}
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
              <button
                type="button"
                disabled={busy}
                onClick={() => { setStep('pick'); setError('') }}
                className="px-3 py-2.5 border border-slate-300 rounded-md text-sm"
              >
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
    </div>
    </ModalPortal>
  )
}
