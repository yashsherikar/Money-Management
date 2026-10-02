import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import { countUnreadLocalNotifications } from '../utils/localAppNotifications.js'
import { checkPendingPayRemindersDue } from '../utils/pendingPayReminders.js'

export default function NotificationBell() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  async function load() {
    try {
      await checkPendingPayRemindersDue()
    } catch { /* ignore */ }
    let serverUnread = 0
    try {
      const { data } = await client.get('/notifications')
      serverUnread = Number(data.unreadCount) || 0
    } catch { /* offline ok */ }
    const localUnread = countUnreadLocalNotifications()
    // Also surface waiting pays that already passed 15 min (reminded) via local list;
    // if local list empty but waiting aged, still bump badge via waiting count after remind.
    setUnreadCount(serverUnread + localUnread)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    const onLocal = () => load()
    window.addEventListener('mm-local-notifications-changed', onLocal)
    window.addEventListener('mm-pending-p2p-changed', onLocal)
    return () => {
      clearInterval(id)
      window.removeEventListener('mm-local-notifications-changed', onLocal)
      window.removeEventListener('mm-pending-p2p-changed', onLocal)
    }
  }, [])

  const showDot = unreadCount > 0

  return (
    <button
      onClick={() => navigate('/notifications')}
      className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
      title={t('Notifications')}
      aria-label={t('Notifications')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {showDot && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
