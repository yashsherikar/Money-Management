import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import NotificationBell from './NotificationBell.jsx'

const qrIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="5" height="5" x="3" y="3" rx="1" />
    <rect width="5" height="5" x="16" y="3" rx="1" />
    <rect width="5" height="5" x="3" y="16" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </svg>
)

function ScanNavTab({ t }) {
  return (
    <NavLink
      to="/scan-pay"
      className="flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5 pb-1.5 text-dim"
    >
      {({ isActive }) => (
        <>
          <span
            className={`scan-nav-orb flex items-center justify-center rounded-full transition-transform duration-200 ${
              isActive ? 'scale-110' : 'scale-100'
            }`}
            style={{
              color: isActive ? '#E8F4FF' : 'rgba(200, 230, 255, 0.92)',
              background: isActive
                ? 'radial-gradient(circle at 35% 30%, rgba(180, 220, 255, 0.55), rgba(100, 170, 240, 0.28) 55%, rgba(70, 140, 220, 0.18))'
                : 'radial-gradient(circle at 35% 30%, rgba(210, 235, 255, 0.45), rgba(140, 195, 245, 0.22) 55%, rgba(90, 160, 230, 0.12))',
              border: '1px solid rgba(170, 210, 255, 0.45)',
              boxShadow: isActive
                ? '0 0 0 1px rgba(140, 190, 255, 0.25), 0 6px 16px rgba(80, 150, 230, 0.22)'
                : '0 4px 12px rgba(80, 150, 230, 0.12)',
              backdropFilter: 'blur(6px)',
            }}
          >
            {qrIcon}
          </span>
          <span className={`nav-tab-label font-medium ${isActive ? 'text-teal' : 'text-dim'}`}>{t('Scan')}</span>
        </>
      )}
    </NavLink>
  )
}

/** Left of center QR */
const leftTabs = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
      </svg>
    ),
  },
  {
    to: '/transactions',
    label: 'Transactions',
    shortLabel: 'Txns',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 3" />
      </svg>
    ),
  },
]

/** Right of center QR */
const rightTabs = [
  {
    to: '/obligations',
    label: 'Obligations',
    shortLabel: 'Dues',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  { to: '/settings', label: 'Settings' },
]

function NavTab({ to, end, label, shortLabel, icon, t }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5 pb-1.5 font-medium transition-colors duration-200 ${isActive ? 'text-teal' : 'text-dim'}`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`transition-transform duration-200 shrink-0 ${isActive ? 'scale-110' : 'scale-100'}`}>{icon}</span>
          <span className="nav-tab-label">
            {shortLabel ? (
              <>
                <span className="nav-label-full">{t(label)}</span>
                <span className="nav-label-short">{t(shortLabel)}</span>
              </>
            ) : (
              t(label)
            )}
          </span>
        </>
      )}
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [moreClosing, setMoreClosing] = useState(false)
  const moreActive = moreOpen || moreLinks.some((l) => location.pathname === l.to)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function closeMore() {
    setMoreClosing(true)
    setTimeout(() => {
      setMoreOpen(false)
      setMoreClosing(false)
    }, 200)
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col overflow-x-hidden">
      <header className="app-header sticky top-0 z-40 bg-white border-b border-slate-200 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo-32.png" alt="" className="w-7 h-7 rounded-lg shrink-0" />
          <span className="font-bold text-brand-700 tracking-tight text-[0.95rem] sm:text-base truncate">Money Manager</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <NotificationBell />
          <button type="button" onClick={() => setLang(lang === 'mr' ? 'en' : 'mr')} className="w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" title={lang === 'mr' ? 'English' : 'मराठी'}>
            {lang === 'mr' ? 'EN' : 'मर'}
          </button>
          <button type="button" onClick={handleLogout} className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50" title={t('Log out')} aria-label={t('Log out')}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 14l4-4-4-4M17 10H7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <main className="app-main flex-1 pt-4 md:px-8 md:pt-8 max-w-6xl mx-auto w-full">
        <div key={location.pathname} className="animate-page-in w-full max-w-full">{children}</div>
      </main>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className={`absolute inset-0 bg-black/40 ${moreClosing ? '' : 'animate-backdrop-in'}`}
            style={moreClosing ? { opacity: 0, transition: 'opacity 0.2s ease-in' } : undefined}
            onClick={closeMore}
          />
          <nav className={`relative bg-white w-full max-h-[75vh] rounded-t-2xl p-4 pb-[max(2rem,env(safe-area-inset-bottom))] flex flex-col gap-1 shadow-xl overflow-y-auto ${moreClosing ? 'animate-sheet-down' : 'animate-sheet-up'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-brand-700">{t('More')}</span>
              <button type="button" onClick={closeMore} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-9 h-9 flex items-center justify-center" aria-label={t('Close')}>×</button>
            </div>
            {moreLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={closeMore}
                className={({ isActive }) =>
                  `px-3 py-3 rounded-lg text-sm font-medium border-l-2 transition-colors duration-200 ${
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

      <nav className="app-bottom-nav fixed bottom-0 inset-x-0 z-40 bg-navbar border-t border-slate-800 flex overflow-visible">
        {leftTabs.map((tab) => (
          <NavTab key={tab.to} to={tab.to} end={tab.to === '/'} label={tab.label} shortLabel={tab.shortLabel} icon={tab.icon} t={t} />
        ))}

        <ScanNavTab t={t} />

        {rightTabs.map((tab) => (
          <NavTab key={tab.to} to={tab.to} label={tab.label} shortLabel={tab.shortLabel} icon={tab.icon} t={t} />
        ))}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5 pb-1.5 font-medium transition-colors duration-200 ${moreActive ? 'text-teal' : 'text-dim'}`}
        >
          <span className={`transition-transform duration-200 shrink-0 ${moreActive ? 'scale-110' : 'scale-100'}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
            </svg>
          </span>
          <span className="nav-tab-label">{t('More')}</span>
        </button>
      </nav>
    </div>
  )
}
