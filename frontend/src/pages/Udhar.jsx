import { useEffect, useState } from 'react'
import client from '../api/client'
import StatCard from '../components/StatCard.jsx'
import { EditIcon, DeleteIcon } from '../components/icons.jsx'
import Field from '../components/Field.jsx'
import CollapsibleSection from '../components/CollapsibleSection.jsx'
import MoneyRow, { MoneyList, RowAction } from '../components/MoneyRow.jsx'
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
  const [formOpen, setFormOpen] = useState(false)

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
    setFormOpen(false)
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    setFormOpen(true)
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

      <CollapsibleSection title={t('Add entry')} addLabel={t('+ Add')} open={formOpen} onOpen={() => setFormOpen(true)}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={t('Type')}>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full">
            <option value="LENT">{t('I gave (lent)')}</option>
            <option value="BORROWED">{t('I took (borrowed)')}</option>
          </select>
        </Field>
        <Field label={t('Contact name')}>
          <input required placeholder={t('Contact name')} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="w-full" />
        </Field>
        <Field label={t('Amount')}>
          <input required type="number" step="0.01" min="0.01" placeholder={t('Amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full" />
        </Field>
        <Field label={t('Account')}>
          <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="w-full">
            <option value="">{t("Don't touch any account balance")}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label={t('Date')}>
          <input type="date" required value={form.txnDate} onChange={(e) => setForm({ ...form, txnDate: e.target.value })} className="w-full" />
        </Field>
        <Field label={t('Due date (optional)')}>
          <input type="date" placeholder={t('Due date (optional)')} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full" />
        </Field>
        <Field label={t('Note (optional)')}>
          <input placeholder={t('Note (optional)')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full" />
        </Field>
        <Field label={t("Their Money Manager email (optional, to send a repayment reminder)")}>
          <input
            type="email"
            placeholder={t("Their Money Manager email (optional, to send a repayment reminder)")}
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            className="w-full"
          />
        </Field>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">{editingId ? t('Update entry') : t('Add entry')}</button>
          <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>
      </CollapsibleSection>

      <MoneyList empty={t('No udhar entries yet.')}>
        {entries.map((e) => (
          <MoneyRow
            key={e.id}
            title={(
              <span>
                {e.type === 'LENT' ? `${t('You gave')} ${e.contactName}` : `${t('You took from')} ${e.contactName}`}
                {e.settled && <span className="ml-2 text-xs text-emerald-600 font-medium">{t('SETTLED')}</span>}
              </span>
            )}
            meta={[e.txnDate, e.dueDate ? `${t('due')} ${e.dueDate}` : null, e.accountName, e.note].filter(Boolean).join(' · ')}
            amount={e.amount}
            income={e.type === 'LENT'}
            iconText={e.contactName}
            actions={(
              <>
                {!e.settled && e.type === 'BORROWED' && e.contactLinked && (
                  <RowAction onClick={() => handleRequestSettle(e.id)}>
                    {e.settleRequested ? t('Remind again') : t('Notify lender')}
                  </RowAction>
                )}
                {!e.settled && <RowAction onClick={() => handleSettle(e.id)}>{t('Settle')}</RowAction>}
                {!e.settled && <RowAction onClick={() => startEdit(e)}><EditIcon /><span>{t('Edit')}</span></RowAction>}
                <RowAction onClick={() => handleDelete(e.id)} tone="danger"><DeleteIcon /><span>{t('Delete')}</span></RowAction>
              </>
            )}
          />
        ))}
      </MoneyList>
    </div>
  )
}
