import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function NotificationBell() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const boxRef = useRef(null)

  async function load() {
    const { data } = await client.get('/notifications')
    setItems(data.notifications)
    setUnreadCount(data.unreadCount)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function markViewed(item) {
    if (item.viewed) return
    await client.patch(`/notifications/${item.id}/viewed`)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, viewed: true } : i)))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  function handleView(item) {
    markViewed(item)
    setOpen(false)
    navigate(item.url)
  }

  function handlePayNow(item) {
    markViewed(item)
    if (item.payUrl) window.location.href = item.payUrl
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        title={t('Notifications')}
        aria-label={t('Notifications')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-[70vh] overflow-y-auto">
          <div className="p-3 border-b border-slate-100 font-semibold text-sm">{t('Notifications')}</div>
          {items.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No notifications yet.')}</div>}
          {items.map((item) => (
            <div key={item.id} className="p-3 border-b border-slate-100 last:border-0 flex gap-2">
              {!item.viewed && <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-500 shrink-0" />}
              <div className={`flex-1 min-w-0 ${item.viewed ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{item.title}</div>
                  <div className="text-xs text-slate-400 shrink-0">{timeAgo(item.createdAt)}</div>
                </div>
                <div className="text-sm text-slate-600 mt-0.5">{item.body}</div>
                <div className="flex gap-2 mt-2">
                  {item.actionType === 'PAID_VIEW' && (
                    <button onClick={() => handleView(item)} className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-md px-2.5 py-1 font-medium">{t('Paid')}</button>
                  )}
                  {item.actionType === 'PAY_VIEW' && item.payUrl && (
                    <button onClick={() => handlePayNow(item)} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-2.5 py-1 font-medium">{t('Pay now')}</button>
                  )}
                  <button onClick={() => handleView(item)} className="text-xs border border-slate-300 rounded-md px-2.5 py-1">{t('View')}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
