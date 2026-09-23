import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const tabs = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
      </svg>
    ),
  },
  {
    to: '/transactions',
    label: 'History',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    to: '/obligations',
    label: 'Obligations',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M8 2v4M16 2v4" />
      </svg>
    ),
  },
]

const moreLinks = [
  { to: '/recurring', label: 'Recurring' },
  { to: '/investments', label: 'Investments' },
  { to: '/udhar', label: 'Udhar' },
  { to: '/split-bills', label: 'Split Bills' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/requests', label: 'Requests' },
  { to: '/profile', label: 'Profile' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo-32.png" alt="" className="w-7 h-7 rounded-lg" />
          <span className="font-bold text-brand-700 tracking-tight">Money Manager</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setLang(lang === 'mr' ? 'en' : 'mr')} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" title={lang === 'mr' ? 'English' : 'मराठी'}>
            {lang === 'mr' ? 'EN' : 'मर'}
          </button>
          <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50" title={t('Log out')} aria-label={t('Log out')}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 14l4-4-4-4M17 10H7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 pb-24 max-w-6xl mx-auto w-full">{children}</main>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <nav className="relative bg-white w-full max-h-[75vh] rounded-t-2xl p-4 pb-8 flex flex-col gap-1 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-brand-700">{t('More')}</span>
              <button onClick={() => setMoreOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center" aria-label={t('Close')}>×</button>
            </div>
            {moreLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-lg text-sm font-medium border-l-2 transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700 border-brand-500' : 'text-slate-600 hover:bg-slate-100 border-transparent'
                  }`
                }
              >
                {t(l.label)}
              </NavLink>
            ))}
            <div className="mt-2 pt-3 border-t border-slate-200 text-sm text-slate-500 truncate">{user?.name}</div>
          </nav>
        </div>
      )}

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-navbar border-t border-slate-800 pt-2 pb-[env(safe-area-inset-bottom,8px)] flex">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 pb-2 text-[11px] font-medium ${isActive ? 'text-teal' : 'text-dim'}`
            }
          >
            {tab.icon}
            {t(tab.label)}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center gap-1 pb-2 text-[11px] font-medium ${moreOpen ? 'text-teal' : 'text-dim'}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
          {t('More')}
        </button>
      </nav>
    </div>
  )
}
