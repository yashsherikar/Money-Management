import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { EyeIcon, EyeOffIcon } from '../components/icons.jsx'
import { bootstrapNotifications } from '../utils/notificationBootstrap.js'

export default function Signup() {
  const { user, signup } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName) {
      setError(t('Enter your name'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t('Enter a valid email'))
      return
    }
    if (password.length < 6) {
      setError(t('Password must be at least 6 characters'))
      return
    }
    setLoading(true)
    try {
      await signup(trimmedEmail, password, trimmedName)
      bootstrapNotifications({ refreshPush: true }).catch(() => {})
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || t('Signup failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="auth-shell min-h-screen min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 relative"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        onClick={() => setLang(lang === 'mr' ? 'en' : 'mr')}
        aria-label={lang === 'mr' ? 'Switch to English' : 'Switch to Marathi'}
        className="absolute top-4 right-4 z-10 text-sm text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg"
      >
        {lang === 'mr' ? 'English' : 'मराठी'}
      </button>

      <div className="relative z-10 w-full max-w-sm mb-7 text-center animate-fade-up">
        <img src="/logo-32.png" alt="Money Manager" className="w-14 h-14 rounded-2xl mx-auto mb-4 shadow-glow" />
        <div className="auth-brand">Money Manager</div>
        <p className="mt-2 text-sm text-slate-500">{t('Start tracking in under a minute')}</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-card w-full max-w-sm p-7 animate-page-in">
        <h1 className="text-lg font-semibold text-slate-900 mb-5">{t('Create account')}</h1>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-2.5 rounded-xl">{error}</div>}
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('Name')}</label>
        <input
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('Email')}</label>
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('Password')}</label>
        <div className="relative mb-6">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('Hide password') : t('Show password')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 rounded-md disabled:opacity-60"
        >
          {loading ? t('Creating...') : t('Sign up')}
        </button>
        <p className="mt-5 text-sm text-slate-600 text-center">
          {t('Already have an account?')} <Link to="/login" className="text-brand-600 font-medium">{t('Log in')}</Link>
        </p>
      </form>
    </div>
  )
}
