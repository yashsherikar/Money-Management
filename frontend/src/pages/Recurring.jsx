import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

const emptyForm = { accountId: '', categoryId: '', type: 'EXPENSE', amount: '', description: '', dayOfMonth: '1' }

export default function Recurring() {
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  async function loadAll() {
    const [itemsRes, accRes, catRes] = await Promise.all([
      client.get('/recurring-transactions'),
      client.get('/accounts'),
      client.get('/categories'),
    ])
    setItems(itemsRes.data)
    setAccounts(accRes.data)
    setCategories(catRes.data)
    const primary = accRes.data.find((a) => a.isPrimary)
    if (primary) setForm((f) => (f.accountId ? f : { ...f, accountId: String(primary.id) }))
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await client.post('/recurring-transactions', {
        accountId: Number(form.accountId),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        type: form.type,
        amount: Number(form.amount),
        description: form.description,
        dayOfMonth: Number(form.dayOfMonth),
      })
      setForm(emptyForm)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function toggleActive(item) {
    await client.patch(`/recurring-transactions/${item.id}/active?active=${!item.active}`)
    loadAll()
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this recurring item?'))) return
    await client.delete(`/recurring-transactions/${id}`)
    loadAll()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('Recurring transactions')}</h1>
      <p className="text-sm text-slate-500 mb-6">{t('Mobile recharge, sending money to parents, rent, subscriptions, salary — anything that repeats monthly gets auto-logged on its day.')}</p>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <select required value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
          <option value="">{t('Account...')}</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
          <option value="">{t('No category')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
          <option value="EXPENSE">{t('Expense (recharge, rent, sending to parents...)')}</option>
          <option value="INCOME">{t('Income (salary...)')}</option>
        </select>
        <input required placeholder={t('Description (e.g. Mobile recharge, Money to parents)')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md md:col-span-2" />
        <input required type="number" step="0.01" min="0.01" placeholder={t('Amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <input required type="number" min="1" max="28" placeholder={t('Day of month (1-28)')} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium md:col-span-2">{t('Add recurring transaction')}</button>
        {error && <div className="md:col-span-3 text-sm text-red-600">{error}</div>}
      </form>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {items.length === 0 && <div className="p-4 text-sm text-slate-500">{t('Nothing set up yet.')}</div>}
        {items.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-medium">{r.description}{!r.active && <span className="ml-2 text-xs text-slate-400">({t('paused')})</span>}</div>
              <div className="text-xs text-slate-500">{t('day')} {r.dayOfMonth} {t('of every month')} · {r.accountName}{r.categoryName ? ` · ${r.categoryName}` : ''}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`font-semibold ${r.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>{money(r.amount)}</div>
              <button onClick={() => toggleActive(r)} className="text-sm text-brand-600">{r.active ? t('Pause') : t('Resume')}</button>
              <button onClick={() => handleDelete(r.id)} className="text-sm text-red-600">{t('Delete')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
