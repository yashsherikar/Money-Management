import { useEffect, useState } from 'react'
import client from '../api/client'
import { categoryIcon } from '../utils/categoryIcon.js'
import { EditIcon, DeleteIcon } from '../components/icons.jsx'
import Field from '../components/Field.jsx'
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
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  async function loadAll() {
    const [txnRes, accRes, catRes] = await Promise.all([
      client.get('/transactions'),
      client.get('/accounts'),
      client.get('/categories'),
    ])
    setTransactions(txnRes.data)
    setAccounts(accRes.data)
    setCategories(catRes.data)
    const primary = accRes.data.find((a) => a.isPrimary) || accRes.data[0]
    if (primary) setForm((f) => (f.accountId ? f : { ...f, accountId: String(primary.id) }))
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

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    const { data } = await client.post('/categories', { name: newCategoryName.trim(), essential: false })
    setCategories((prev) => [...prev, data])
    setForm((f) => ({ ...f, categoryId: String(data.id) }))
    setNewCategoryName('')
    setAddingCategory(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Transactions (this month)')}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 mb-6 flex flex-col gap-4">
        <Field label={t('Account')}>
          <select required value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="w-full">
            <option value="">{t('Account...')}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>

        <Field label={t('Category')}>
          {form.type === 'INCOME' ? (
            <select
              value={categories.find((c) => String(c.id) === form.categoryId && INCOME_SOURCES.includes(c.name))?.name || 'Other'}
              onChange={(e) => {
                const match = categories.find((c) => c.name === e.target.value)
                setForm({ ...form, categoryId: match ? String(match.id) : '' })
              }}
              className="w-full"
            >
              {INCOME_SOURCES.map((name) => <option key={name} value={name}>{t(name)}</option>)}
              <option value="Other">{t('Other')}</option>
            </select>
          ) : addingCategory ? (
            <div className="flex gap-2">
              <input
                autoFocus
                placeholder={t('New category name')}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory(e))}
                className="flex-1"
              />
              <button type="button" onClick={handleAddCategory} className="px-3 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium">{t('Add')}</button>
              <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryName('') }} className="px-3 py-2 rounded-md border border-slate-300 text-sm">{t('Cancel')}</button>
            </div>
          ) : (
            <select
              value={form.categoryId}
              onChange={(e) => {
                const picked = categories.find((c) => String(c.id) === e.target.value)
                if (picked?.name === 'Other') setAddingCategory(true)
                else setForm({ ...form, categoryId: e.target.value })
              }}
              className="w-full"
            >
              <option value="">{t('No category')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name === 'Other' ? t('Other (add new)') : c.name}{!c.essential ? ` ${t('(non-essential)')}` : ''}</option>)}
            </select>
          )}
        </Field>

        <Field label={t('Type')}>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, categoryId: '' })} className="w-full">
            <option value="EXPENSE">{t('Expense')}</option>
            <option value="INCOME">{t('Income')}</option>
          </select>
        </Field>

        <Field label={t('Amount')}>
          <input type="number" step="0.01" min="0.01" required placeholder={t('Amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full" />
        </Field>

        <Field label={t('Description')}>
          <input
            placeholder={t('Description')}
            required={form.type === 'INCOME' && !form.categoryId}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full"
          />
        </Field>

        <Field label={t('Date')}>
          <input type="date" required value={form.txnDate} onChange={(e) => setForm({ ...form, txnDate: e.target.value })} className="w-full" />
        </Field>

        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">
            {editingId ? t('Update') : t('Add')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
          )}
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {transactions.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No transactions this month.')}</div>}
        {transactions.map((txn) => (
          <div key={txn.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{categoryIcon(`${txn.description || ''} ${txn.categoryName || ''}`, txn.type)}</span>
              <div>
                <div className="font-medium">{txn.description || txn.categoryName || t('Transaction')}</div>
                <div className="text-xs text-slate-500">{txn.txnDate} · {txn.accountName}{txn.categoryName ? ` · ${txn.categoryName}` : ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`font-semibold ${txn.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                {txn.type === 'INCOME' ? '+' : '-'}₹{Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <button onClick={() => startEdit(txn)} aria-label={t('Edit')} title={t('Edit')} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-slate-100"><EditIcon /></button>
              <button onClick={() => handleDelete(txn.id)} aria-label={t('Delete')} title={t('Delete')} className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"><DeleteIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
