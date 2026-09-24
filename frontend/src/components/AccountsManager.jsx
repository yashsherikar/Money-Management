import { useEffect, useState } from 'react'
import client from '../api/client'
import Field from './Field.jsx'
import { EditIcon, DeleteIcon } from './icons.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const TYPES = ['BANK', 'CASH', 'CARD', 'EMERGENCY_FUND']

export default function AccountsManager() {
  const { t } = useLanguage()
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ name: '', type: 'BANK', balance: '', isPrimary: false, minimumBalance: '' })
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const [balancesRevealed, setBalancesRevealed] = useState(false)
  const [askingPin, setAskingPin] = useState(false)
  const [pin, setPin] = useState('')
  const [revealError, setRevealError] = useState('')

  async function load() {
    const { data } = await client.get('/accounts')
    setAccounts(data)
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setForm({ name: '', type: 'BANK', balance: '', isPrimary: false, minimumBalance: '' })
    setEditingId(null)
    setFormOpen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        name: form.name,
        type: form.type,
        balance: form.balance === '' ? 0 : Number(form.balance),
        isPrimary: form.isPrimary,
        minimumBalance: form.minimumBalance === '' ? 0 : Number(form.minimumBalance),
      }
      if (editingId) {
        await client.put(`/accounts/${editingId}`, payload)
      } else {
        await client.post('/accounts', payload)
      }
      resetForm()
      load()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  function startEdit(acc) {
    setEditingId(acc.id)
    setForm({ name: acc.name, type: acc.type, balance: acc.balance, isPrimary: acc.isPrimary, minimumBalance: acc.minimumBalance })
    setFormOpen(true)
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this account? Its transactions stay recorded but lose this link.'))) return
    await client.delete(`/accounts/${id}`)
    load()
  }

  function openReveal() {
    setRevealError('')
    setPin('')
    setAskingPin(true)
  }

  async function submitReveal(e) {
    e.preventDefault()
    setRevealError('')
    try {
      await client.post('/profile/reveal-balance', { pin })
      setBalancesRevealed(true)
      setAskingPin(false)
    } catch (err) {
      setRevealError(err.response?.data?.message || t('Incorrect PIN'))
    }
  }

  function hideBalances() {
    setBalancesRevealed(false)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{t('Accounts')}</h2>
        {!formOpen && (
          <button onClick={() => setFormOpen(true)} className="text-sm text-brand-600 font-medium">
            {t('+ Add account')}
          </button>
        )}
      </div>

      {formOpen && (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-4">
        <Field label={t('Account name')}>
          <input
            placeholder={t('Account name')}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full"
          />
        </Field>
        <Field label={t('Type')}>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full"
          >
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>{t(ty)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('Opening balance')}>
          <input
            type="number"
            step="0.01"
            placeholder={t('Opening balance')}
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value })}
            className="w-full"
          />
        </Field>
        <Field label={t('Minimum balance to maintain (optional)')}>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={t('Minimum balance to maintain (optional)')}
            value={form.minimumBalance}
            onChange={(e) => setForm({ ...form, minimumBalance: e.target.value })}
            className="w-full"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
          {t('Primary account — default for daily spending, EMIs, and everything else you log')}
        </label>
        <p className="text-xs text-slate-500 -mt-2">
          {t('Minimum balance is excluded from affordability checks and your "Total across all accounts" figure — it never counts as spendable.')}
        </p>
        {form.type === 'EMERGENCY_FUND' && (
          <p className="text-xs text-amber-600">{t('Emergency fund money is excluded from affordability checks — it never counts as spendable.')}</p>
        )}
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">
            {editingId ? t('Update') : t('Add')}
          </button>
          <button type="button" onClick={resetForm} className="px-3 py-2 rounded-md border border-slate-300">
            {t('Cancel')}
          </button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>
      )}

      {askingPin && (
        <form onSubmit={submitReveal} className="flex items-center gap-2 mb-3">
          <input
            type="password" inputMode="numeric" autoFocus placeholder={t('Enter PIN')}
            value={pin} onChange={(e) => setPin(e.target.value)}
            className="w-32"
          />
          <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-2 text-sm font-medium">{t('Unlock')}</button>
          <button type="button" onClick={() => setAskingPin(false)} className="text-sm text-slate-500">{t('Cancel')}</button>
          {revealError && <span className="text-sm text-red-600">{revealError}</span>}
        </form>
      )}

      {balancesRevealed && (
        <div className="flex justify-end mb-2">
          <button onClick={hideBalances} className="text-xs text-slate-500">{t('Hide balances')}</button>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
        {accounts.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No accounts yet.')}</div>}
        {accounts.map((acc) => (
          <div key={acc.id} className="p-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate flex items-center gap-1.5">
                {acc.isPrimary && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#00F5D4" stroke="#00F5D4" className="shrink-0" title={t('Primary account')}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
                <span className="truncate">{acc.name}</span>
                {acc.isPrimary && <span className="text-xs text-teal font-medium whitespace-nowrap">{t('PRIMARY')}</span>}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {t(acc.type)}
                {Number(acc.minimumBalance) > 0 && ` · ${t('min balance')} ₹${Number(acc.minimumBalance).toLocaleString('en-IN')}`}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {balancesRevealed ? (
                <div className={`font-semibold whitespace-nowrap ${acc.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  ₹{Number(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              ) : (
                <button onClick={openReveal} className="font-semibold text-slate-300 tracking-widest select-none whitespace-nowrap" title={t('Tap to reveal')}>
                  ₹ • • • •
                </button>
              )}
              <button onClick={() => startEdit(acc)} aria-label={t('Edit')} title={t('Edit')} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-slate-100"><EditIcon /></button>
              <button onClick={() => handleDelete(acc.id)} aria-label={t('Delete')} title={t('Delete')} className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"><DeleteIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
