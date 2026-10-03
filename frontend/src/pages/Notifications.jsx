import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import MoneyRow, { MoneyList, RowAction } from '../components/MoneyRow.jsx'
import {
  RELATED,
  confirmDuePaid,
  parseConfirmIdFromUrl,
  notifyTransactionsChanged,
  clearNotificationPayAction,
  clearPaidReminders,
} from '../utils/confirmDuePaid.js'
import { openUpiPayLink, parseUpiQr, isPersonalUpi, copyVpaAndOpenApp, formatUpiAmount } from '../utils/upiQr.js'
import {
  listLocalAppNotifications,
  markLocalAppNotificationViewed,
} from '../utils/localAppNotifications.js'
import { checkPendingPayRemindersDue } from '../utils/pendingPayReminders.js'
import { savePendingUpiConfirm, suppressResumeLock } from '../appLock.js'

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

async function confirmFromNotificationItem(item) {
  if (item.relatedType && item.relatedId != null) {
    await confirmDuePaid(item.relatedType, item.relatedId)
    return true
  }
  const confirmId = parseConfirmIdFromUrl(item.url)
  if (confirmId && item.url?.startsWith('/recurring')) {
    await confirmDuePaid(RELATED.RECURRING, confirmId)
    return true
  }
  return false
}

function needsPayNow(item) {
  return item.actionType === 'PAY_VIEW' && !!item.payUrl && !item.paidCleared
}

function needsMarkPaid(item) {
  return item.actionType === 'PAID_VIEW' && !item.paidCleared
}

export default function Notifications() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState('')

  async function load() {
    try {
      await checkPendingPayRemindersDue()
    } catch { /* ignore */ }

    let server = []
    try {
      const { data } = await client.get('/notifications')
      server = data.notifications || []
    } catch { /* offline */ }

    const local = listLocalAppNotifications().map((n) => ({
      ...n,
      actionType: n.kind === 'pending_pay' ? 'PENDING_PAY'
        : (n.kind === 'subscription' || n.kind === 'due' || n.kind === 'recurring') ? 'PAID_VIEW'
          : null,
      payUrl: null,
      relatedType: n.relatedType || (n.kind === 'subscription' || n.kind === 'due' || n.kind === 'recurring'
        ? RELATED.RECURRING
        : null),
      relatedId: n.relatedId != null ? Number(n.relatedId) || n.relatedId : null,
    }))

    const merged = [...local, ...server].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    setItems(merged)
  }

  useEffect(() => {
    load()
    const onLocal = () => load()
    window.addEventListener('mm-local-notifications-changed', onLocal)
    window.addEventListener('mm-pending-p2p-changed', onLocal)
    window.addEventListener('mm-transactions-changed', onLocal)
    return () => {
      window.removeEventListener('mm-local-notifications-changed', onLocal)
      window.removeEventListener('mm-pending-p2p-changed', onLocal)
      window.removeEventListener('mm-transactions-changed', onLocal)
    }
  }, [])

  async function markViewed(item) {
    if (item.viewed) return
    if (item.local) {
      markLocalAppNotificationViewed(item.id)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, viewed: true } : i)))
      return
    }
    await client.patch(`/notifications/${item.id}/viewed`)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, viewed: true } : i)))
  }

  function markClearedLocally(item) {
    setItems((prev) => prev.map((i) => (
      i.id === item.id
        ? { ...i, actionType: 'VIEW_ONLY', payUrl: null, paidCleared: true, viewed: true }
        : i
    )))
  }

  function handleView(item) {
    markViewed(item)
    navigate(item.url?.split('?')[0] || item.url || '/pending-pays')
  }

  async function handlePayNow(item) {
    markViewed(item)
    if (!item.payUrl) return
    try {
      const parsed = parseUpiQr(item.payUrl)
      suppressResumeLock(5 * 60_000)
      // So after GPay we ask "Did you pay?" and can clear Pay now
      savePendingUpiConfirm({
        kind: item.relatedType === 'SPLIT_PARTICIPANT' ? 'split_bill'
          : item.relatedType === 'CONTRIBUTION_REQUEST' ? 'contribution'
            : 'payment_request',
        requestId: item.relatedId,
        participantId: item.relatedType === 'SPLIT_PARTICIPANT' ? item.relatedId : null,
        notificationId: item.id,
        pa: parsed.pa,
        am: formatUpiAmount(parsed.am) || '1.00',
        amount: formatUpiAmount(parsed.am) || '1.00',
        name: parsed.pn || parsed.pa,
        pn: parsed.pn || '',
      })
      if (isPersonalUpi(parsed.mc) || parsed.personal) {
        await copyVpaAndOpenApp({
          pa: parsed.pa,
          amount: formatUpiAmount(parsed.am) || '1.00',
          app: 'gpay',
        })
      } else {
        await openUpiPayLink(item.payUrl, {
          pa: parsed.pa,
          amount: parsed.am,
          pn: parsed.pn,
          merchant: true,
          mc: parsed.mc,
          app: 'gpay',
        })
      }
    } catch {
      openUpiPayLink(item.payUrl).catch(() => {})
    }
  }

  /** User already paid — remove Pay now without opening UPI again. */
  async function handleAlreadyPaid(item) {
    setBusyId(item.id)
    setToast('')
    try {
      await markViewed(item)
      if (item.relatedType === 'PAYMENT_REQUEST' && item.relatedId) {
        await client.patch(`/payment-requests/${item.relatedId}/confirm-sent`).catch(() => {})
      }
      await clearNotificationPayAction(item.id)
      if (item.relatedType && item.relatedId != null) {
        await clearPaidReminders(item.relatedType, item.relatedId)
      }
      markClearedLocally(item)
      setToast(t('Marked as paid — Pay now removed'))
      await load()
    } catch (err) {
      setToast(err.response?.data?.message || err.message || t('Could not mark as paid'))
    } finally {
      setBusyId(null)
    }
  }

  async function handlePaid(item) {
    setBusyId(item.id)
    setToast('')
    try {
      await markViewed(item)
      const logged = await confirmFromNotificationItem(item)
      await clearNotificationPayAction(item.id)
      markClearedLocally(item)
      if (logged) {
        notifyTransactionsChanged()
        await load()
        navigate('/transactions')
        return
      }
      await load()
      navigate(item.url?.split('?')[0] || item.url || '/recurring')
    } catch (err) {
      setToast(err.response?.data?.message || err.message || t('Could not mark as paid'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Notifications')}</h1>
      {toast && (
        <div className={`mb-4 text-sm p-2 rounded ${/paid|removed|Logged/i.test(toast) ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
          {toast}
        </div>
      )}
      <MoneyList empty={t('No notifications yet.')}>
        {items.map((item) => (
          <MoneyRow
            key={item.id}
            title={(
              <span className="inline-flex items-center gap-2">
                {!item.viewed && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />}
                <span className={item.viewed ? 'opacity-70' : ''}>{item.title}</span>
                {(item.paidCleared || item.actionType === 'VIEW_ONLY') && (
                  <span className="text-[10px] uppercase tracking-wide bg-emerald-500/15 text-emerald-700 px-2 py-0.5 rounded font-semibold">
                    {t('Paid')}
                  </span>
                )}
              </span>
            )}
            meta={(
              <span className={item.viewed ? 'opacity-70' : ''}>
                {item.body}
                <span className="text-slate-400"> · {timeAgo(item.createdAt)}</span>
              </span>
            )}
            hideAmount
            iconText={item.title}
            type="EXPENSE"
            actions={(
              <>
                {needsMarkPaid(item) && (
                  <button
                    type="button"
                    onClick={() => handlePaid(item)}
                    disabled={busyId === item.id}
                    className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 font-medium disabled:opacity-60"
                  >
                    {busyId === item.id ? t('Saving…') : t('Paid')}
                  </button>
                )}
                {needsPayNow(item) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePayNow(item)}
                      className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-3 py-1.5 font-medium"
                    >
                      {t('Pay now')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlreadyPaid(item)}
                      disabled={busyId === item.id}
                      className="text-xs border border-slate-300 rounded-md px-3 py-1.5 font-medium disabled:opacity-60"
                    >
                      {busyId === item.id ? t('Saving…') : t('I already paid')}
                    </button>
                  </>
                )}
                {item.actionType === 'PENDING_PAY' && (
                  <button
                    type="button"
                    onClick={() => handleView(item)}
                    className="text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1.5 font-medium"
                  >
                    {t('Check pending')}
                  </button>
                )}
                <RowAction onClick={() => handleView(item)}>{t('View')}</RowAction>
              </>
            )}
          />
        ))}
      </MoneyList>
    </div>
  )
}
