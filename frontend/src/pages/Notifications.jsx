import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import {
  RELATED,
  confirmDuePaid,
  parseConfirmIdFromUrl,
  notifyTransactionsChanged,
} from '../utils/confirmDuePaid.js'
import { openUpiPayLink } from '../utils/upiQr.js'

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

  function handlePayNow(item) {
    markViewed(item)
    if (item.payUrl) openUpiPayLink(item.payUrl)
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
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {items.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No notifications yet.')}</div>}
        {items.map((item) => (
          <div key={item.id} className="p-4 flex gap-3">
            {!item.viewed && <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-brand-500 shrink-0" />}
            <div className={`flex-1 min-w-0 ${item.viewed ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-slate-400 shrink-0">{timeAgo(item.createdAt)}</div>
              </div>
              <div className="text-sm text-slate-600 mt-0.5">{item.body}</div>
              <div className="flex gap-2 mt-2">
                {item.actionType === 'PAID_VIEW' && (
                  <button
                    onClick={() => handlePaid(item)}
                    disabled={busyId === item.id}
                    className="text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 font-medium disabled:opacity-60"
                  >
                    {busyId === item.id ? t('Saving…') : t('Paid')}
                  </button>
                )}
                {item.actionType === 'PAY_VIEW' && item.payUrl && (
                  <button onClick={() => handlePayNow(item)} className="text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-3 py-1.5 font-medium">{t('Pay now')}</button>
                )}
                <button onClick={() => handleView(item)} className="text-sm border border-slate-300 rounded-md px-3 py-1.5">{t('View')}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
