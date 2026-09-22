import { useEffect, useState } from 'react'
import client from '../api/client'
import StatCard from '../components/StatCard.jsx'
import { EditIcon, DeleteIcon } from '../components/icons.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

const emptyForm = { accountId: '', contactName: '', type: 'LENT', amount: '', note: '', txnDate: new Date().toISOString().slice(0, 10), dueDate: '', contactEmail: '' }

export default function Udhar() {
  const { t } = useLanguage()
  const [entries, setEntries] = useState([])
  const [summary, setSummary] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  async function loadAll() {
    const [entriesRes, summaryRes, accountsRes] = await Promise.all([
      client.get('/udhar'),
      client.get('/udhar/summary'),
      client.get('/accounts'),
    ])
    setEntries(entriesRes.data)
    setSummary(summaryRes.data)
    setAccounts(accountsRes.data)
    const primary = accountsRes.data.find((a) => a.isPrimary) || accountsRes.data[0]
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
        accountId: form.accountId ? Number(form.accountId) : null,
        contactName: form.contactName,
        type: form.type,
        amount: Number(form.amount),
        note: form.note || null,
        txnDate: form.txnDate,
        dueDate: form.dueDate || null,
        contactEmail: form.contactEmail || null,
      }
      if (editingId) {
        await client.put(`/udhar/${editingId}`, payload)
      } else {
        await client.post('/udhar', payload)
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
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    setForm({
      accountId: entry.accountId ? String(entry.accountId) : '',
      contactName: entry.contactName,
      type: entry.type,
      amount: String(entry.amount),
      note: entry.note || '',
      txnDate: entry.txnDate,
      dueDate: entry.dueDate || '',
      contactEmail: entry.contactEmail || '',
    })
  }

  async function handleSettle(id) {
    await client.patch(`/udhar/${id}/settle`)
    loadAll()
  }

  async function handleRequestSettle(id) {
    setError('')
    try {
      await client.post(`/udhar/${id}/request-settle`)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this entry?'))) return
    await client.delete(`/udhar/${id}`)
    loadAll()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Udhar (lend / borrow)')}</h1>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard label={t('Owed to you')} value={money(summary.totalOwedToYou)} tone="good" />
          <StatCard label={t('You owe')} value={money(summary.totalYouOwe)} tone="bad" />
          <StatCard label={t('Net position')} value={money(summary.netPosition)} tone={Number(summary.netPosition) >= 0 ? 'good' : 'bad'} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
          <option value="LENT">{t('I gave (lent)')}</option>
          <option value="BORROWED">{t('I took (borrowed)')}</option>
        </select>
        <input required placeholder={t('Contact name')} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <input required type="number" step="0.01" min="0.01" placeholder={t('Amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
          <option value="">{t("Don't touch any account balance")}</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="date" required value={form.txnDate} onChange={(e) => setForm({ ...form, txnDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <input type="date" placeholder={t('Due date (optional)')} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <input placeholder={t('Note (optional)')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md md:col-span-2" />
        <input
          type="email"
          placeholder={t("Their Money Manager email (optional, to send a repayment reminder)")}
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-md"
        />
        <div className="flex gap-2 md:col-span-3">
          <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium">{editingId ? t('Update entry') : t('Add entry')}</button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
          )}
        </div>
        {error && <div className="md:col-span-3 text-sm text-red-600">{error}</div>}
      </form>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {entries.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No udhar entries yet.')}</div>}
        {entries.map((e) => (
          <div key={e.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-medium">
                {e.type === 'LENT' ? `${t('You gave')} ${e.contactName}` : `${t('You took from')} ${e.contactName}`}
                {e.settled && <span className="ml-2 text-xs text-emerald-600 font-medium">{t('SETTLED')}</span>}
              </div>
              <div className="text-xs text-slate-500">
                {e.txnDate}{e.dueDate ? ` · ${t('due')} ${e.dueDate}` : ''}{e.accountName ? ` · ${e.accountName}` : ''}{e.note ? ` · ${e.note}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`font-semibold ${e.type === 'LENT' ? 'text-emerald-600' : 'text-red-600'}`}>{money(e.amount)}</div>
              {!e.settled && e.type === 'BORROWED' && e.contactLinked && (
                <button onClick={() => handleRequestSettle(e.id)} className="text-sm text-brand-600">
                  {e.settleRequested ? t('Remind again') : t('Notify lender')}
                </button>
              )}
              {!e.settled && <button onClick={() => handleSettle(e.id)} className="text-sm text-brand-600">{t('Settle')}</button>}
              {!e.settled && (
                <button onClick={() => startEdit(e)} aria-label={t('Edit')} title={t('Edit')} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-slate-100"><EditIcon /></button>
              )}
              <button onClick={() => handleDelete(e.id)} aria-label={t('Delete')} title={t('Delete')} className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"><DeleteIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
