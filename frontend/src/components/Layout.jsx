import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/obligations', label: 'Obligations' },
  { to: '/udhar', label: 'Udhar' },
  { to: '/split-bills', label: 'Split Bills' },
  { to: '/investments', label: 'Investments' },
  { to: '/recurring', label: 'Recurring' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/groups', label: 'Groups' },
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

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 flex md:flex-col gap-2">
        <div className="flex items-center gap-2 mb-2">
          <img src="/logo-32.png" alt="" className="w-6 h-6" />
          <span className="font-bold text-brand-600 text-lg hidden md:inline">Money Manager</span>
        </div>
        <nav className="flex md:flex-col gap-1 flex-1 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {t(l.label)}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block mt-auto pt-4 border-t border-slate-200">
          <div className="text-sm text-slate-500 truncate">{user?.name}</div>
          <button
            onClick={() => setLang(lang === 'mr' ? 'en' : 'mr')}
            className="mt-2 text-sm text-slate-600 hover:underline block"
          >
            {lang === 'mr' ? 'English' : 'मराठी'}
          </button>
          <button onClick={toggleTheme} className="mt-2 text-sm text-slate-600 hover:underline block">
            {t('Toggle dark mode')}
          </button>
          <button onClick={handleLogout} className="mt-2 text-sm text-red-600 hover:underline">
            {t('Log out')}
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  )
}
