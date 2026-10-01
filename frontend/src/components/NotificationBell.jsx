import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function NotificationBell() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  async function load() {
    const { data } = await client.get('/notifications')
    setUnreadCount(data.unreadCount)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

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
      {unreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />
      )}
    </button>
  )
}
