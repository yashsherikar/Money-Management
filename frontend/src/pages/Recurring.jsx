import { useEffect, useState } from 'react'
import client from '../api/client'
import { categoryIcon } from '../utils/categoryIcon.js'
import { EditIcon, DeleteIcon } from '../components/icons.jsx'
import DayOfMonthSelect from '../components/DayOfMonthSelect.jsx'
import Field from '../components/Field.jsx'
import CollapsibleSection from '../components/CollapsibleSection.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

const today = new Date().toISOString().slice(0, 10)
const emptyForm = { accountId: '', categoryId: '', type: 'EXPENSE', amount: '', description: '', recurrenceType: 'MONTHLY', dayOfMonth: '1', lastDoneDate: today, nextDueDate: '' }

export default function Recurring() {
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  async function loadAll() {
    const [itemsRes, accRes, catRes] = await Promise.all([
      client.get('/recurring-transactions'),
      client.get('/accounts'),
      client.get('/categories'),
    ])
    setItems(itemsRes.data)
    setAccounts(accRes.data)
    setCategories(catRes.data)
    const primary = accRes.data.find((a) => a.isPrimary) || accRes.data[0]
    if (primary) setForm((f) => (f.accountId ? f : { ...f, accountId: String(primary.id) }))
  }

  useEffect(() => {
    loadAll()
  }, [])

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
        recurrenceType: form.recurrenceType,
        dayOfMonth: form.recurrenceType === 'MONTHLY' ? Number(form.dayOfMonth) : null,
        lastDoneDate: form.recurrenceType === 'INTERVAL_DAYS' ? form.lastDoneDate : null,
        nextDueDate: form.recurrenceType === 'INTERVAL_DAYS' ? form.nextDueDate : null,
      }
      if (editingId) {
        await client.put(`/recurring-transactions/${editingId}`, payload)
      } else {
        await client.post('/recurring-transactions', payload)
      }
      resetForm()
      loadAll()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setFormOpen(false)
  }

  function startEdit(item) {
    setEditingId(item.id)
    setFormOpen(true)
    const lastDoneDate = item.nextDueDate && item.intervalDays
      ? new Date(new Date(item.nextDueDate).getTime() - item.intervalDays * 86400000).toISOString().slice(0, 10)
      : today
    setForm({
      accountId: String(item.accountId),
      categoryId: item.categoryId ? String(item.categoryId) : '',
      type: item.type,
      amount: String(item.amount),
      description: item.description,
      recurrenceType: item.recurrenceType,
      dayOfMonth: item.dayOfMonth ? String(item.dayOfMonth) : '1',
      lastDoneDate,
      nextDueDate: item.nextDueDate || '',
    })
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
      <h1 className="text-2xl font-bold mb-2">{t('Recurring transactions')}</h1>
      <p className="text-sm text-slate-500 mb-6">{t('Mobile recharge, sending money to parents, rent, subscriptions, salary — anything that repeats monthly gets auto-logged on its day.')}</p>

      <CollapsibleSection title={t('Add recurring transaction')} addLabel={t('+ Add')} open={formOpen} onOpen={() => setFormOpen(true)}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={t('Account')}>
          <select required value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="w-full">
            <option value="">{t('Account...')}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>

        <Field label={t('Category')}>
          {addingCategory ? (
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
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name === 'Other' ? t('Other (add new)') : c.name}</option>)}
            </select>
          )}
        </Field>

        <Field label={t('Type')}>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full">
            <option value="EXPENSE">{t('Expense (recharge, rent, sending to parents...)')}</option>
            <option value="INCOME">{t('Income (salary...)')}</option>
          </select>
        </Field>

        <Field label={t('Description')}>
          <input required placeholder={t('Description (e.g. Mobile recharge, Money to parents)')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full" />
        </Field>

        <Field label={t('Amount')}>
          <input required type="number" step="0.01" min="0.01" placeholder={t('Amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full" />
        </Field>

        <Field label={t('Repeats')}>
          <select value={form.recurrenceType} onChange={(e) => setForm({ ...form, recurrenceType: e.target.value })} className="w-full">
            <option value="MONTHLY">{t('Same day every month')}</option>
            <option value="INTERVAL_DAYS">{t('Every N days (e.g. 28-day recharge)')}</option>
          </select>
        </Field>

        {form.recurrenceType === 'MONTHLY' ? (
          <Field label={t('Day of month')}>
            <DayOfMonthSelect value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} className="w-full" />
          </Field>
        ) : (
          <>
            <Field label={t('Last done on')}>
              <input required type="date" value={form.lastDoneDate} onChange={(e) => setForm({ ...form, lastDoneDate: e.target.value })} className="w-full" />
            </Field>
            <Field label={t('Next due date')}>
              <input required type="date" min={form.lastDoneDate} value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} className="w-full" />
            </Field>
          </>
        )}

        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">
            {editingId ? t('Update recurring transaction') : t('Add recurring transaction')}
          </button>
          <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>
      </CollapsibleSection>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {items.length === 0 && <div className="p-4 text-sm text-slate-500">{t('Nothing set up yet.')}</div>}
        {items.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl leading-none">{categoryIcon(`${r.description || ''} ${r.categoryName || ''}`, r.type)}</span>
              <div>
                <div className="font-medium">{r.description}{!r.active && <span className="ml-2 text-xs text-slate-400">({t('paused')})</span>}</div>
                <div className="text-xs text-slate-500">
                  {r.recurrenceType === 'INTERVAL_DAYS'
                    ? `${t('every')} ${r.intervalDays} ${t('days')} · ${t('next')} ${r.nextDueDate}`
                    : `${t('day')} ${r.dayOfMonth} ${t('of every month')}`}
                  {' · '}{r.accountName}{r.categoryName ? ` · ${r.categoryName}` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`font-semibold ${r.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>{money(r.amount)}</div>
              <button onClick={() => toggleActive(r)} className="text-sm text-brand-600">{r.active ? t('Pause') : t('Resume')}</button>
              <button onClick={() => startEdit(r)} aria-label={t('Edit')} title={t('Edit')} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-slate-100"><EditIcon /></button>
              <button onClick={() => handleDelete(r.id)} aria-label={t('Delete')} title={t('Delete')} className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"><DeleteIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
