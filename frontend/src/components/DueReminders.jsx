import { useCallback, useEffect, useState } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { confirmDuePaid, RELATED } from '../utils/confirmDuePaid.js'
import ModalPortal from '../utils/ModalPortal.jsx'
import { useBodyScrollLock } from '../utils/useBodyScrollLock.js'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

export default function DueReminders() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [dismissed, setDismissed] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const loadDue = useCallback(() => {
    if (!user) return
    client.get('/recurring-transactions/due')
      .then((res) => {
        // Daily autopay (every 1 day) — bank SMS covers it; don't nag
        const list = (res.data || []).filter((item) => !(
          item.recurrenceType === 'INTERVAL_DAYS'
          && (!item.intervalDays || Number(item.intervalDays) <= 1)
        ))
        setItems(list)
        if (!list.length) {
          setDismissed(false)
          setError('')
        }
      })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    loadDue()
    const onChange = () => loadDue()
    window.addEventListener('mm-transactions-changed', onChange)
    window.addEventListener('mm-local-notifications-changed', onChange)
    const onVis = () => {
      if (document.visibilityState === 'visible') loadDue()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('mm-transactions-changed', onChange)
      window.removeEventListener('mm-local-notifications-changed', onChange)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loadDue])

  async function confirmPaid(id) {
    setBusyId(id)
    setError('')
    try {
      await confirmDuePaid(RELATED.RECURRING, id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      const msg = String(err?.response?.data?.message || err?.message || '')
      if (/already confirmed|not due/i.test(msg)) {
        setItems((prev) => prev.filter((i) => i.id !== id))
      } else {
        setError(msg || t('Could not mark as paid'))
      }
    } finally {
      setBusyId(null)
    }
  }

  const show = !!(user && !dismissed && items.length > 0)
  useBodyScrollLock(show)
  if (!show) return null

  return (
    <ModalPortal>
    <div className="app-modal" role="dialog" aria-modal="true">
      <div className="app-modal-backdrop" onClick={() => setDismissed(true)} />
      <div className="app-modal-panel">
        <div className="app-modal-body">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg">{t('Did you pay these?')}</h2>
          <button onClick={() => setDismissed(true)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">{t("These are due this month and haven't been confirmed yet.")}</p>
        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{item.description}</div>
                <div className="font-semibold">{money(item.amount)}</div>
              </div>
              <div className="text-xs text-slate-500 mb-2">
                {item.recurrenceType === 'INTERVAL_DAYS'
                  ? `${t('Every')} ${item.intervalDays} ${t('days')}`
                  : `${t('Due day')} ${item.dayOfMonth} ${t('of this month')}`}
              </div>

              {expandedId === item.id && (
                <div className="text-sm text-slate-600 bg-slate-50 rounded p-2 mb-2 space-y-0.5">
                  <div>{t('From/to:')} {item.description}</div>
                  <div>{t('Account:')} {item.accountName}</div>
                  {item.categoryName && <div>{t('Category:')} {item.categoryName}</div>}
                  <div>{t('Type:')} {item.type === 'INCOME' ? t('Money in') : t('Money out')}</div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => confirmPaid(item.id)}
                  className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                >
                  {busyId === item.id ? t('Saving…') : t('Yes, paid')}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                >
                  {expandedId === item.id ? t('Hide details') : t('View details')}
                </button>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}
