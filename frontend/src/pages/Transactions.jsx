import { useEffect, useState } from 'react'
import client from '../api/client'
import { categoryIcon } from '../utils/categoryIcon.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const emptyForm = { accountId: '', categoryId: '', type: 'EXPENSE', amount: '', description: '', txnDate: new Date().toISOString().slice(0, 10) }
const INCOME_SOURCES = ['Salary', 'Freelance', 'Share Market']

export default function Transactions() {
  const { t } = useLanguage()
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  async function loadAll() {
    const [txnRes, accRes, catRes] = await Promise.all([
      client.get('/transactions'),
      client.get('/accounts'),
      client.get('/categories'),
    ])
    setTransactions(txnRes.data)
    setAccounts(accRes.data)
    setCategories(catRes.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        accountId: Number(form.accountId),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        type: form.type,
        amount: Number(form.amount),
        description: form.description,
        txnDate: form.txnDate,
      }
      if (editingId) {
        await client.put(`/transactions/${editingId}`, payload)
      } else {
        await client.post('/transactions', payload)
      }
      resetForm()
      loadAll()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  function startEdit(txn) {
    setEditingId(txn.id)
    setForm({
      accountId: String(txn.accountId),
      categoryId: txn.categoryId ? String(txn.categoryId) : '',
      type: txn.type,
      amount: String(txn.amount),
      description: txn.description || '',
      txnDate: txn.txnDate,
    })
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this transaction?'))) return
    await client.delete(`/transactions/${id}`)
    loadAll()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Transactions (this month)')}</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <select required value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
          <option value="">{t('Account...')}</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {form.type === 'INCOME' ? (
          <select
            value={categories.find((c) => String(c.id) === form.categoryId && INCOME_SOURCES.includes(c.name))?.name || 'Other'}
            onChange={(e) => {
              const match = categories.find((c) => c.name === e.target.value)
              setForm({ ...form, categoryId: match ? String(match.id) : '' })
            }}
            className="px-3 py-2 border border-slate-300 rounded-md"
          >
            {INCOME_SOURCES.map((name) => <option key={name} value={name}>{t(name)}</option>)}
            <option value="Other">{t('Other')}</option>
          </select>
        ) : (
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
            <option value="">{t('No category')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{!c.essential ? ` ${t('(non-essential)')}` : ''}</option>)}
          </select>
        )}
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, categoryId: '' })} className="px-3 py-2 border border-slate-300 rounded-md">
          <option value="EXPENSE">{t('Expense')}</option>
          <option value="INCOME">{t('Income')}</option>
        </select>
        <input type="number" step="0.01" min="0.01" required placeholder={t('Amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <input
          placeholder={t('Description')}
          required={form.type === 'INCOME' && !form.categoryId}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-md"
        />
        <input type="date" required value={form.txnDate} onChange={(e) => setForm({ ...form, txnDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <div className="md:col-span-3 flex gap-2">
          <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium">
            {editingId ? t('Update') : t('Add')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
          )}
        </div>
        {error && <div className="md:col-span-3 text-sm text-red-600">{error}</div>}
      </form>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {transactions.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No transactions this month.')}</div>}
        {transactions.map((txn) => (
          <div key={txn.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{categoryIcon(txn.categoryName, txn.type)}</span>
              <div>
                <div className="font-medium">{txn.description || txn.categoryName || t('Transaction')}</div>
                <div className="text-xs text-slate-500">{txn.txnDate} · {txn.accountName}{txn.categoryName ? ` · ${txn.categoryName}` : ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`font-semibold ${txn.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                {txn.type === 'INCOME' ? '+' : '-'}₹{Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <button onClick={() => startEdit(txn)} className="text-sm text-brand-600">{t('Edit')}</button>
              <button onClick={() => handleDelete(txn.id)} className="text-sm text-red-600">{t('Delete')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
