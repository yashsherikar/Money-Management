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
} from '../utils/confirmDuePaid.js'
import { openUpiPayLink, parseUpiQr, isPersonalUpi, copyVpaAndOpenApp, formatUpiAmount } from '../utils/upiQr.js'

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

export default function Notifications() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState('')

  async function load() {
    const { data } = await client.get('/notifications')
    setItems(data.notifications)
  }

  useEffect(() => {
    load()
  }, [])

  async function markViewed(item) {
    if (item.viewed) return
    await client.patch(`/notifications/${item.id}/viewed`)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, viewed: true } : i)))
  }

  function handleView(item) {
    markViewed(item)
    navigate(item.url?.split('?')[0] || item.url)
  }

  async function handlePayNow(item) {
    markViewed(item)
    if (!item.payUrl) return
    try {
      const parsed = parseUpiQr(item.payUrl)
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

  async function handlePaid(item) {
    setBusyId(item.id)
    setToast('')
    try {
      await markViewed(item)
      const logged = await confirmFromNotificationItem(item)
      if (logged) {
        notifyTransactionsChanged()
        await load()
        navigate('/transactions')
        return
      }
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
        <div className={`mb-4 text-sm p-2 rounded ${toast.includes(t('Logged')) ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
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
                {item.actionType === 'PAID_VIEW' && (
                  <button
                    type="button"
                    onClick={() => handlePaid(item)}
                    disabled={busyId === item.id}
                    className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 font-medium disabled:opacity-60"
                  >
                    {busyId === item.id ? t('Saving…') : t('Paid')}
                  </button>
                )}
                {item.actionType === 'PAY_VIEW' && item.payUrl && (
                  <button
                    type="button"
                    onClick={() => handlePayNow(item)}
                    className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-3 py-1.5 font-medium"
                  >
                    {t('Pay now')}
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
