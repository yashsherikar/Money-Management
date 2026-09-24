import { useEffect, useState } from 'react'
import client from '../api/client'
import Field from '../components/Field.jsx'
import CollapsibleSection from '../components/CollapsibleSection.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

const emptyForm = {
  title: '',
  totalAmount: '',
  accountId: '',
  billDate: new Date().toISOString().slice(0, 10),
  note: '',
  participants: [{ name: '', shareAmount: '', email: '' }],
}

export default function SplitBills() {
  const { t } = useLanguage()
  const [bills, setBills] = useState([])
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  async function loadAll() {
    const [billsRes, accountsRes] = await Promise.all([client.get('/split-bills'), client.get('/accounts')])
    setBills(billsRes.data)
    setAccounts(accountsRes.data)
    const primary = accountsRes.data.find((a) => a.isPrimary) || accountsRes.data[0]
    if (primary) setForm((f) => (f.accountId ? f : { ...f, accountId: String(primary.id) }))
  }

  useEffect(() => {
    loadAll()
  }, [])

  function updateParticipant(index, field, value) {
    const participants = form.participants.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    setForm({ ...form, participants })
  }

  function addParticipantRow() {
    setForm({ ...form, participants: [...form.participants, { name: '', shareAmount: '', email: '' }] })
  }

  function removeParticipantRow(index) {
    setForm({ ...form, participants: form.participants.filter((_, i) => i !== index) })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await client.post('/split-bills', {
        title: form.title,
        totalAmount: Number(form.totalAmount),
        accountId: form.accountId ? Number(form.accountId) : null,
        billDate: form.billDate,
        note: form.note || null,
        participants: form.participants
          .filter((p) => p.name && p.shareAmount)
          .map((p) => ({ name: p.name, shareAmount: Number(p.shareAmount), email: p.email || null })),
      })
      setForm(emptyForm)
      setFormOpen(false)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function handleMarkPaid(participantId) {
    await client.put(`/split-bills/participants/${participantId}/pay`)
    loadAll()
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this split bill?'))) return
    await client.delete(`/split-bills/${id}`)
    loadAll()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Split a bill')}</h1>

      <CollapsibleSection title={t('Split a bill')} addLabel={t('+ Add')} open={formOpen} onOpen={() => setFormOpen(true)}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={t('What was it for')}>
          <input required placeholder={t('What was it for')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full" />
        </Field>
        <Field label={t('Total amount')}>
          <input required type="number" step="0.01" min="0.01" placeholder={t('Total amount')} value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} className="w-full" />
        </Field>
        <Field label={t('Account')}>
          <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="w-full">
            <option value="">{t("Don't touch any account balance")}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label={t('Bill date')}>
          <input type="date" required value={form.billDate} onChange={(e) => setForm({ ...form, billDate: e.target.value })} className="w-full" />
        </Field>

        <div className="flex flex-col gap-3">
          <div className="text-[13px] font-bold text-muted">{t('Who owes what')}</div>
          {form.participants.map((p, i) => (
            <div key={i} className="bg-slate-50 rounded-2xl p-3 flex flex-col gap-2">
              <input placeholder={t('Name')} value={p.name} onChange={(e) => updateParticipant(i, 'name', e.target.value)} className="w-full" />
              <input type="number" step="0.01" min="0.01" placeholder={t('Their share')} value={p.shareAmount} onChange={(e) => updateParticipant(i, 'shareAmount', e.target.value)} className="w-full" />
              <input type="email" placeholder={t('Their email (optional, if they use this app)')} value={p.email} onChange={(e) => updateParticipant(i, 'email', e.target.value)} className="w-full" />
              {form.participants.length > 1 && (
                <button type="button" onClick={() => removeParticipantRow(i)} className="self-start text-sm text-red-600">{t('Remove')}</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addParticipantRow} className="self-start text-sm text-brand-600">{t('+ Add another person')}</button>
          <p className="text-xs text-slate-500">{t("If their email matches a Money Manager account, this bill shows up on their Requests page too.")}</p>
        </div>

        <Field label={t('Note (optional)')}>
          <input placeholder={t('Note (optional)')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full" />
        </Field>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">{t('Save split')}</button>
          <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>
      </CollapsibleSection>

      <div className="space-y-4">
        {bills.length === 0 && <div className="text-sm text-slate-500">{t('No split bills yet.')}</div>}
        {bills.map((bill) => (
          <div key={bill.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold">{bill.title}</div>
                <div className="text-xs text-slate-500">
                  {bill.billDate} · {t('total')} {money(bill.totalAmount)} · {t('your share')} {money(bill.yourShare)}
                  {bill.accountName ? ` · ${bill.accountName}` : ''}{bill.note ? ` · ${bill.note}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-emerald-600 font-medium">{money(bill.collected)} {t('collected')}</span>
                  {Number(bill.pending) > 0 && <span className="text-slate-500"> · {money(bill.pending)} {t('pending')}</span>}
                </div>
                <button onClick={() => handleDelete(bill.id)} className="text-sm text-red-600">{t('Delete')}</button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 divide-y divide-slate-100">
              {bill.participants.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    {p.name}
                    {p.linked && <span className="ml-2 text-xs text-brand-600" title={t('This person can see and pay this on their own Requests page')}>🔗</span>}
                    {p.paid && <span className="ml-2 text-xs text-emerald-600 font-medium">{t('PAID')}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{money(p.shareAmount)}</span>
                    {!p.paid && <button onClick={() => handleMarkPaid(p.id)} className="text-brand-600">{t('Mark paid')}</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
