import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'

const TYPES = ['BANK', 'CASH', 'CARD', 'EMERGENCY_FUND']

export default function Accounts() {
  const { t } = useLanguage()
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ name: '', type: 'BANK', balance: '', isPrimary: false })
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await client.get('/accounts')
    setAccounts(data)
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setForm({ name: '', type: 'BANK', balance: '', isPrimary: false })
    setEditingId(null)
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
    setForm({ name: acc.name, type: acc.type, balance: acc.balance, isPrimary: acc.isPrimary })
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this account? Its transactions stay recorded but lose this link.'))) return
    await client.delete(`/accounts/${id}`)
    load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Accounts')}</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          placeholder={t('Account name')}
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-md"
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-md"
        >
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>{t(ty)}</option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder={t('Opening balance')}
          value={form.balance}
          onChange={(e) => setForm({ ...form, balance: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-md"
        />
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-2 font-medium">
            {editingId ? t('Update') : t('Add')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-3 py-2 rounded-md border border-slate-300">
              {t('Cancel')}
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-4">
          <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
          {t('Primary account — default for daily spending, EMIs, and everything else you log')}
        </label>
        {form.type === 'EMERGENCY_FUND' && (
          <p className="text-xs text-amber-600 md:col-span-4">{t('Emergency fund money is excluded from affordability checks — it never counts as spendable.')}</p>
        )}
        {error && <div className="md:col-span-4 text-sm text-red-600">{error}</div>}
      </form>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {accounts.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No accounts yet.')}</div>}
        {accounts.map((acc) => (
          <div key={acc.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">
                {acc.name}
                {acc.isPrimary && <span className="ml-2 text-xs text-brand-600 font-medium">{t('PRIMARY')}</span>}
              </div>
              <div className="text-xs text-slate-500">{t(acc.type)}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`font-semibold ${acc.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                ₹{Number(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <button onClick={() => startEdit(acc)} className="text-sm text-brand-600">{t('Edit')}</button>
              <button onClick={() => handleDelete(acc.id)} className="text-sm text-red-600">{t('Delete')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
