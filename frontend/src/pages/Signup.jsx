import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { EyeIcon, EyeOffIcon } from '../components/icons.jsx'
import client from '../api/client'
import { promptNativePushIfNeeded } from '../nativePush.js'

export default function Signup() {
  const { signup } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup(email, password, name)
      await promptNativePushIfNeeded(client)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || t('Signup failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 relative">
      <button
        onClick={() => setLang(lang === 'mr' ? 'en' : 'mr')}
        className="absolute top-4 right-4 text-sm text-slate-600 hover:underline"
      >
        {lang === 'mr' ? 'English' : 'मराठी'}
      </button>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <img src="/logo-32.png" alt="" className="w-8 h-8" />
          <h1 className="text-xl font-bold text-brand-700">{t('Create account')}</h1>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('Name')}</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('Email')}</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('Password')}</label>
        <div className="relative mb-6">
          <input
            type={showPassword ? 'text' : 'password'}
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
          className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2 rounded-md disabled:opacity-60"
        >
          {loading ? t('Creating...') : t('Sign up')}
        </button>
        <p className="mt-4 text-sm text-slate-600 text-center">
          {t('Already have an account?')} <Link to="/login" className="text-brand-600 font-medium">{t('Log in')}</Link>
        </p>
      </form>
    </div>
  )
}
