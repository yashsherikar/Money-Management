import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/recurring', label: 'Recurring' },
  { to: '/obligations', label: 'Obligations' },
  { to: '/investments', label: 'Investments' },
  { to: '/udhar', label: 'Udhar' },
  { to: '/split-bills', label: 'Split Bills' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/requests', label: 'Requests' },
  { to: '/profile', label: 'Profile' },
]

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark')
  localStorage.setItem('theme', isDark ? 'dark' : 'light')
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label={t('Menu')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
          <img src="/logo-32.png" alt="" className="w-7 h-7 rounded-lg" />
          <span className="font-bold text-brand-700 tracking-tight">Money Manager</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setLang(lang === 'mr' ? 'en' : 'mr')} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" title={lang === 'mr' ? 'English' : 'मराठी'}>
            {lang === 'mr' ? 'EN' : 'मर'}
          </button>
          <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" title={t('Toggle dark mode')}>
            🌙
          </button>
          <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50" title={t('Log out')}>
            ⏻
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <nav className="relative bg-white w-72 max-w-[82%] h-full p-4 flex flex-col gap-1 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src="/logo-32.png" alt="" className="w-6 h-6 rounded-lg" />
                <span className="font-bold text-brand-700">Money Manager</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center" aria-label={t('Close')}>×</button>
            </div>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-lg text-sm font-medium border-l-2 transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700 border-brand-500' : 'text-slate-600 hover:bg-slate-100 border-transparent'
                  }`
                }
              >
                {t(l.label)}
              </NavLink>
            ))}
            <div className="mt-auto pt-4 border-t border-slate-200 text-sm text-slate-500 truncate">{user?.name}</div>
          </nav>
        </div>
      )}

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  )
}
