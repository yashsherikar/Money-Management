import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import NotificationBell from './NotificationBell.jsx'
import { countWaitingP2pPays } from '../utils/pendingP2pPays.js'

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

function PayNavTab({ t }) {
  return (
    <NavLink to="/pay" className="nav-item nav-item-pay">
      {({ isActive }) => (
        <>
          <span className={`scan-nav-orb ${isActive ? 'scan-nav-orb-active' : ''}`}>
            {qrIcon}
          </span>
          <span className={`nav-tab-label ${isActive ? 'nav-label-active' : ''}`}>{t('Pay')}</span>
        </>
      )}
    </NavLink>
  )
}

const leftTabs = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
      </svg>
    ),
  },
  {
    to: '/transactions',
    label: 'Transactions',
    shortLabel: 'Txns',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
]

const rightTabs = [
  {
    to: '/pending-pays',
    label: 'Pending pays',
    shortLabel: 'Pending',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
]

const moreLinks = [
  { to: '/obligations', label: 'Obligations' },
  { to: '/recurring', label: 'Recurring' },
  { to: '/investments', label: 'Investments' },
  { to: '/udhar', label: 'Udhar' },
  { to: '/split-bills', label: 'Split Bills' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/requests', label: 'Requests' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
]

function NavTab({ to, end, label, shortLabel, icon, t, badge = 0 }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
    >
      {({ isActive }) => (
        <>
          <span className={`nav-icon-wrap relative ${isActive ? 'nav-icon-active' : ''}`}>
            {icon}
            {badge > 0 && (
              <span className="nav-badge">{badge > 9 ? '9+' : badge}</span>
            )}
          </span>
          <span className={`nav-tab-label ${isActive ? 'nav-label-active' : ''}`}>
            {shortLabel ? (
              <>
                <span className="nav-label-full">{t(label)}</span>
                <span className="nav-label-short">{t(shortLabel)}</span>
              </>
            ) : (
              t(label)
            )}
          </span>
          <span className={`nav-dot ${isActive ? 'nav-dot-on' : ''}`} aria-hidden />
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
  const closeTimer = useRef(null)
  const [pendingCount, setPendingCount] = useState(() => countWaitingP2pPays())
  const moreActive = moreOpen || moreLinks.some((l) => location.pathname === l.to)

  useEffect(() => {
    const refresh = () => setPendingCount(countWaitingP2pPays())
    refresh()
    window.addEventListener('mm-pending-p2p-changed', refresh)
    window.addEventListener('mm-p2p-sms-confirmed', refresh)
    return () => {
      window.removeEventListener('mm-pending-p2p-changed', refresh)
      window.removeEventListener('mm-p2p-sms-confirmed', refresh)
    }
  }, [])

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function openMore() {
    if (moreClosing) return
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setMoreClosing(false)
    setMoreOpen(true)
  }

  function closeMore() {
    if (!moreOpen || moreClosing) return
    setMoreClosing(true)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setMoreOpen(false)
      setMoreClosing(false)
      closeTimer.current = null
    }, 200)
  }

  useEffect(() => {
    if (!moreOpen) return undefined
    function onKey(e) {
      if (e.key === 'Escape') closeMore()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen, moreClosing])

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col overflow-x-hidden">
      <header className="app-header sticky top-0 z-40 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo-32.png" alt="" className="w-8 h-8 rounded-xl shrink-0 ring-1 ring-white/10" />
          <span className="brand-mark text-[0.95rem] sm:text-base truncate">Money Manager</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <NotificationBell />
          <button type="button" onClick={() => setLang(lang === 'mr' ? 'en' : 'mr')} className="w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" title={lang === 'mr' ? 'English' : 'मराठी'} aria-label={lang === 'mr' ? 'English' : 'Marathi'}>
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
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label={t('More')}>
          <div
            className={`absolute inset-0 bg-black/55 backdrop-blur-[1px] ${moreClosing ? '' : 'animate-backdrop-in'}`}
            style={moreClosing ? { opacity: 0, transition: 'opacity 0.2s ease-in' } : undefined}
            onClick={closeMore}
          />
          <nav className={`more-sheet relative w-full max-h-[75vh] p-4 pb-[max(2rem,env(safe-area-inset-bottom))] flex flex-col gap-1 overflow-y-auto ${moreClosing ? 'animate-sheet-down' : 'animate-sheet-up'}`}>
            <div className="more-sheet-handle" aria-hidden />
            <div className="flex items-center justify-between mb-3 mt-1">
              <span className="font-bold text-brand-700 text-lg">{t('More')}</span>
              <button type="button" onClick={closeMore} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-9 h-9 flex items-center justify-center" aria-label={t('Close')}>×</button>
            </div>
            {moreLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={closeMore}
                className={({ isActive }) =>
                  `more-sheet-link ${isActive ? 'more-sheet-link-active' : ''}`
                }
              >
                {t(l.label)}
              </NavLink>
            ))}
            <div className="mt-3 pt-3 border-t border-slate-200 text-sm text-slate-500 truncate">{user?.name}</div>
          </nav>
        </div>
      )}

      <nav className="app-bottom-nav" aria-label="Main">
        <div className="app-bottom-nav-inner">
          {leftTabs.map((tab) => (
            <NavTab key={tab.to} to={tab.to} end={tab.to === '/'} label={tab.label} shortLabel={tab.shortLabel} icon={tab.icon} t={t} />
          ))}

          <PayNavTab t={t} />

          {rightTabs.map((tab) => (
            <NavTab
              key={tab.to}
              to={tab.to}
              label={tab.label}
              shortLabel={tab.shortLabel}
              icon={tab.icon}
              t={t}
              badge={tab.to === '/pending-pays' ? pendingCount : 0}
            />
          ))}

          <button
            type="button"
            onClick={() => (moreOpen ? closeMore() : openMore())}
            className={`nav-item ${moreActive ? 'nav-item-active' : ''}`}
            aria-label={t('More')}
            aria-expanded={moreOpen}
          >
            <span className={`nav-icon-wrap ${moreActive ? 'nav-icon-active' : ''}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className={`nav-tab-label ${moreActive ? 'nav-label-active' : ''}`}>{t('More')}</span>
            <span className={`nav-dot ${moreActive ? 'nav-dot-on' : ''}`} aria-hidden />
          </button>
        </div>
      </nav>
    </div>
  )
}
