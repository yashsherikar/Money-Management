import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import {
  readPendingUpiConfirm,
  clearPendingUpiConfirm,
} from '../appLock.js'

/**
 * GPay/PhonePe never tell us if a P2P payment succeeded.
 * After the user leaves for UPI (and even if both apps are killed), we ask
 * "Did you pay?" from localStorage and let them confirm.
 *
 * Scan&Pay detail confirm stays on /scan-pay; this handles request / other kinds
 * and also re-routes cold starts with a pending scan_pay payload.
 */
export default function PendingPayConfirm() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function refresh() {
    const data = readPendingUpiConfirm()
    if (!data) {
      setPending(null)
      return
    }
    // Scan&Pay has its own richer confirm UI on that page
    if ((!data.kind || data.kind === 'scan_pay') && location.pathname === '/scan-pay') {
      setPending(null)
      return
    }
    if ((!data.kind || data.kind === 'scan_pay') && location.pathname !== '/scan-pay') {
      navigate('/scan-pay', { replace: true })
      return
    }
    setPending(data)
  }

  useEffect(() => {
    refresh()
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', refresh)
    }
  }, [location.pathname, navigate])

  async function confirmYes() {
    if (!pending || busy) return
    setBusy(true)
    setError('')
    try {
      if (pending.kind === 'payment_request' && pending.requestId) {
        await client.patch(`/payment-requests/${pending.requestId}/confirm-sent`)
      }
      // split_bill / contribution: no auto-status from GPay — friend marks received
      clearPendingUpiConfirm()
      setPending(null)
      if (pending.kind === 'payment_request' || pending.kind === 'split_bill' || pending.kind === 'contribution') {
        navigate('/requests', { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('Could not confirm'))
    } finally {
      setBusy(false)
    }
  }

  function confirmNo() {
    clearPendingUpiConfirm()
    setPending(null)
    setError('')
  }

  if (!pending || !pending.kind || pending.kind === 'scan_pay') return null

  const amount = pending.am || pending.amount
  const label = pending.name || pending.pn || pending.pa || t('this payment')

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={confirmNo} />
      <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl m-0 sm:m-4">
        <h2 className="font-bold text-lg mb-2">{t('Did you pay?')}</h2>
        <p className="text-sm text-slate-600 mb-2">
          {t('GPay does not tell this app if payment succeeded. Confirm only if money was sent.')}
        </p>
        <p className="text-sm text-slate-800 mb-4 font-medium">
          {t('Log')} ₹{Number(amount || 0).toLocaleString('en-IN')} {t('to')} {label}?
        </p>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={confirmYes}
            className="flex-1 bg-brand-600 text-white rounded-md py-2.5 font-medium disabled:opacity-60"
          >
            {busy ? t('Saving…') : t('Yes, I paid')}
          </button>
          <button type="button" onClick={confirmNo} className="flex-1 border border-slate-300 rounded-md py-2.5">
            {t('Not yet')}
          </button>
        </div>
      </div>
    </div>
  )
}
