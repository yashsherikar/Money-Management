import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function Profile() {
  const { t } = useLanguage()
  const [form, setForm] = useState({ name: '', upiId: '' })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    client.get('/profile').then((res) => setForm({ name: res.data.name, upiId: res.data.upiId || '' }))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaved(false)
    try {
      await client.put('/profile', form)
      setSaved(true)
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Profile')}</h1>
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 max-w-md">
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('Name')}</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full mb-4 px-3 py-2 border border-slate-300 rounded-md"
        />
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('UPI ID')}</label>
        <input
          placeholder="yourname@upi"
          value={form.upiId}
          onChange={(e) => setForm({ ...form, upiId: e.target.value })}
          className="w-full mb-1 px-3 py-2 border border-slate-300 rounded-md"
        />
        <p className="text-xs text-slate-500 mb-4">
          {t('Needed so group members can pay you directly when they accept a contribution request.')}
        </p>
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
        {saved && <div className="mb-4 text-sm text-emerald-600">{t('Saved.')}</div>}
        <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium">
          {t('Save')}
        </button>
      </form>
    </div>
  )
}
