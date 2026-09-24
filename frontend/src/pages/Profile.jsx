import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import AccountsManager from '../components/AccountsManager.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const size = 240
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function Profile() {
  const { t } = useLanguage()
  const fileInputRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ name: '', upiId: '' })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [balanceRevealed, setBalanceRevealed] = useState(false)
  const [balanceValue, setBalanceValue] = useState(null)
  const [askingPin, setAskingPin] = useState(false)
  const [revealPin, setRevealPin] = useState('')
  const [revealError, setRevealError] = useState('')

  function load() {
    client.get('/profile').then((res) => {
      setProfile(res.data)
      setForm({ name: res.data.name, upiId: res.data.upiId || '' })
    })
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaved(false)
    try {
      await client.put('/profile', form)
      setSaved(true)
      load()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await resizePhoto(file)
    await client.put('/profile/photo', { photo: dataUrl })
    load()
  }

  async function handlePhotoRemove() {
    await client.delete('/profile/photo')
    load()
  }

  function openRevealPrompt() {
    setRevealError('')
    setRevealPin('')
    setAskingPin(true)
  }

  async function submitReveal(e) {
    e.preventDefault()
    setRevealError('')
    try {
      const { data } = await client.post('/profile/reveal-balance', { pin: revealPin })
      setBalanceValue(data)
      setBalanceRevealed(true)
      setAskingPin(false)
    } catch (err) {
      setRevealError(err.response?.data?.message || t('Incorrect PIN'))
    }
  }

  function hideBalance() {
    setBalanceRevealed(false)
    setBalanceValue(null)
  }

  if (!profile) return <div className="text-slate-500">{t('Loading...')}</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Profile')}</h1>

      <div className="max-w-3xl mb-6 bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {profile.photo ? (
              <img src={profile.photo} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-bold">
                {(profile.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-brand-600 block">
              {t('Change photo')}
            </button>
            {profile.photo && (
              <button type="button" onClick={handlePhotoRemove} className="text-sm text-red-600 block mt-1">
                {t('Remove photo')}
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('Name')}</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full mb-4 px-3 py-2 border border-slate-300 rounded-md"
          />
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('Email')}</label>
          <input value={profile.email} disabled className="w-full mb-4 px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-500" />
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('UPI ID')}</label>
          <input
            placeholder="yourname@upi"
            value={form.upiId}
            onChange={(e) => setForm({ ...form, upiId: e.target.value })}
            className="w-full mb-1 px-3 py-2 border border-slate-300 rounded-md"
          />
          <p className="text-xs text-slate-500 mb-4">
            {t('Needed so people can pay you directly when they accept a contribution request.')}
          </p>
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
          {saved && <div className="mb-4 text-sm text-emerald-600">{t('Saved.')}</div>}
          <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium">
            {t('Save')}
          </button>
        </form>
      </div>

      <div className="max-w-3xl mb-6 bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold mb-1">{t('Total across all accounts')}</h2>
        <p className="text-xs text-slate-500 mb-4">{t('Hidden by default — needs your secret PIN to reveal.')}</p>

        {balanceRevealed ? (
          <div>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold tracking-tight">{money(balanceValue.totalBalance)}</div>
              <button onClick={hideBalance} className="text-sm text-slate-500">{t('Hide')}</button>
            </div>
            {(Number(balanceValue.udharOwed) > 0 || Number(balanceValue.lockedMinimumBalance) > 0) && (
              <p className="text-xs text-slate-500 mt-2">
                {t('Cash in accounts')}: {money(balanceValue.cashOnHand)}
                {Number(balanceValue.udharOwed) > 0 && ` · ${t('Udhar you owe')}: −${money(balanceValue.udharOwed)}`}
                {Number(balanceValue.lockedMinimumBalance) > 0 && ` · ${t('Locked minimum balance')}: −${money(balanceValue.lockedMinimumBalance)}`}
              </p>
            )}
            {balanceValue.byAccount?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                {balanceValue.byAccount.map((a) => (
                  <div key={a.accountId} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{a.accountName}</span>
                    <span className="font-medium">{money(a.balance)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : askingPin ? (
          <form onSubmit={submitReveal} className="flex items-center gap-2">
            <input
              type="password" inputMode="numeric" autoFocus placeholder={t('Enter PIN')}
              value={revealPin} onChange={(e) => setRevealPin(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md w-32"
            />
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-2 text-sm font-medium">{t('Unlock')}</button>
            <button type="button" onClick={() => setAskingPin(false)} className="text-sm text-slate-500">{t('Cancel')}</button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold tracking-tight text-slate-300 select-none">₹ • • • • • •</div>
            {profile.pinSet ? (
              <button onClick={openRevealPrompt} className="text-sm text-brand-600">{t('Unlock')}</button>
            ) : (
              <span className="text-xs text-slate-400">{t('Set a PIN in Settings')}</span>
            )}
          </div>
        )}
        {revealError && <div className="mt-2 text-sm text-red-600">{revealError}</div>}
      </div>

      <div className="max-w-3xl">
        <AccountsManager />
      </div>
    </div>
  )
}
