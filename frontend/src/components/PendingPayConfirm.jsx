import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import {
  readPendingUpiConfirm,
  clearPendingUpiConfirm,
} from '../appLock.js'
import { clearNotificationPayAction } from '../utils/confirmDuePaid.js'
import { useBodyScrollLock } from '../utils/useBodyScrollLock.js'
import ModalPortal from '../utils/ModalPortal.jsx'

/**
 * GPay/PhonePe never tell us if a P2P payment succeeded.
 * After the user leaves for UPI (and even if both apps are killed), we ask
 * "Did you pay?" from localStorage and let them confirm.
 *
 * Handles request / split / scan&pay / generic UPI confirms in one place.
 */
export default function PendingPayConfirm() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useBodyScrollLock(!!pending)

  function refresh() {
    setPending(readPendingUpiConfirm())
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
  }, [])

  async function confirmYes() {
    if (!pending || busy) return
    setBusy(true)
    setError('')
    try {
      if (pending.kind === 'payment_request' && pending.requestId) {
        await client.patch(`/payment-requests/${pending.requestId}/confirm-sent`)
      }
      if (pending.notificationId) {
        await clearNotificationPayAction(pending.notificationId)
      }
      const { handleDetectedUpiPayment, closePendingAfterUpiLog } = await import('../utils/paymentNotify.js')
      const parsed = {
        amount: Number(pending.am || pending.amount),
        pa: pending.pa,
        payeeName: pending.pn || pending.name,
        source: 'manual',
        personal: pending.kind !== 'scan_pay',
        kind: pending.kind === 'scan_pay' ? 'scan_pay' : 'p2p',
        forceLog: true,
        categoryId: pending.categoryId || null,
        description: pending.description || null,
      }
      const logResult = await handleDetectedUpiPayment(parsed)
      if (!(logResult?.logged || logResult?.duplicate)) {
        setError(logResult?.error || t('Could not log payment — try again'))
        return
      }
      await closePendingAfterUpiLog(parsed, logResult)
      clearPendingUpiConfirm()
      setPending(null)
      try {
        window.dispatchEvent(new CustomEvent('mm-local-notifications-changed'))
        window.dispatchEvent(new Event('mm-transactions-changed'))
      } catch { /* ignore */ }
      if (pending.kind === 'payment_request' || pending.kind === 'split_bill' || pending.kind === 'contribution') {
        navigate('/notifications', { replace: true })
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

  if (!pending) return null

  const amount = pending.am || pending.amount
  const label = pending.name || pending.pn || pending.pa || t('this payment')

  return (
    <ModalPortal>
    <div className="app-modal" role="dialog" aria-modal="true" aria-labelledby="pending-pay-title">
      <div className="app-modal-backdrop" onClick={confirmNo} />
      <div className="app-modal-panel">
        <div className="app-modal-body">
          <h2 id="pending-pay-title" className="font-bold text-lg mb-2">{t('Did you pay?')}</h2>
          <p className="text-sm text-slate-600 mb-2">
            {t('GPay does not tell this app if payment succeeded. Confirm only if money was sent.')}
          </p>
          <p className="text-sm text-slate-800 mb-4 font-medium break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>
            {t('Log')} ₹{Number(amount || 0).toLocaleString('en-IN')} {t('to')} {label}?
          </p>
          {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded break-words">{error}</div>}
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
    </div>
    </ModalPortal>
  )
}
