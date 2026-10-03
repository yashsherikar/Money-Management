import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import Field from '../components/Field.jsx'
import CollapsibleSection from '../components/CollapsibleSection.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { suppressResumeLock, savePendingUpiConfirm } from '../appLock.js'
import { copyVpaAndOpenApp, parseUpiQr, formatUpiAmount } from '../utils/upiQr.js'

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

const emptyParticipant = () => ({ name: '', shareAmount: '', sharePercent: '', email: '' })

const emptyForm = {
  title: '',
  totalAmount: '',
  accountId: '',
  categoryId: '',
  billDate: new Date().toISOString().slice(0, 10),
  note: '',
  sourceTransactionId: null,
  splitMode: 'percent', // 'percent' | 'amount'
  participants: [emptyParticipant()],
}

export default function SplitBills() {
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [bills, setBills] = useState([])
  const [owedBills, setOwedBills] = useState([])
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [fromTxnNote, setFromTxnNote] = useState('')
  const [payingId, setPayingId] = useState(null)

  const total = Number(form.totalAmount) || 0

  const computed = useMemo(() => {
    const people = form.participants.map((p) => {
      let pct = Number(p.sharePercent)
      let amt = Number(p.shareAmount)
      if (form.splitMode === 'percent' && total > 0 && Number.isFinite(pct) && pct > 0) {
        amt = round2((total * pct) / 100)
      } else if (form.splitMode === 'amount' && total > 0 && Number.isFinite(amt) && amt > 0) {
        pct = round2((amt / total) * 100)
      }
      return { ...p, shareAmount: amt > 0 ? amt : 0, sharePercent: pct > 0 ? pct : 0 }
    })
    const othersAmount = round2(people.reduce((s, p) => s + (Number(p.shareAmount) || 0), 0))
    const othersPercent = round2(people.reduce((s, p) => s + (Number(p.sharePercent) || 0), 0))
    const yourShare = round2(Math.max(0, total - othersAmount))
    const yourPercent = total > 0 ? round2((yourShare / total) * 100) : 0
    return { people, othersAmount, othersPercent, yourShare, yourPercent }
  }, [form.participants, form.splitMode, total])

  async function loadAll() {
    const [billsRes, accountsRes, owedRes] = await Promise.all([
      client.get('/split-bills'),
      client.get('/accounts'),
      client.get('/split-bills/owed-by-me').catch(() => ({ data: [] })),
    ])
    setBills(billsRes.data)
    setAccounts(accountsRes.data)
    setOwedBills(owedRes.data || [])
    const primary = accountsRes.data.find((a) => a.isPrimary) || accountsRes.data[0]
    if (primary) setForm((f) => (f.accountId ? f : { ...f, accountId: String(primary.id) }))
  }

  async function payOwedSplit(b) {
    if (!b.upiPayLink && !b.requesterUpiId) {
      alert(t("hasn't added a UPI ID yet"))
      return
    }
    setPayingId(b.participantId)
    try {
      let pa = b.requesterUpiId || ''
      let am = formatUpiAmount(b.shareAmount)
      if (!pa && b.upiPayLink) {
        try {
          const parsed = parseUpiQr(b.upiPayLink)
          pa = parsed.pa
          am = formatUpiAmount(parsed.am || b.shareAmount) || am
        } catch { /* ignore */ }
      }
      if (!pa || !am) {
        alert(t('Could not open UPI app'))
        return
      }
      suppressResumeLock(300_000)
      savePendingUpiConfirm({
        kind: 'split_bill',
        requestId: b.participantId,
        participantId: b.participantId,
        pa,
        am,
        amount: am,
        name: b.payerName || pa,
        pn: b.payerName || '',
      })
      await copyVpaAndOpenApp({ pa, amount: am, app: 'gpay' })
    } catch (e) {
      alert(e.message || t('Could not open UPI app'))
    } finally {
      setPayingId(null)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Prefill from Transactions → Split (≤ 2 days)
  useEffect(() => {
    const txnId = searchParams.get('txnId')
    if (!txnId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: txns } = await client.get('/transactions')
        const txn = (txns || []).find((x) => String(x.id) === String(txnId))
        if (cancelled) return
        if (!txn) {
          setError(t('Transaction not found'))
          return
        }
        if (txn.splitBillId) {
          setError(t('This transaction is already split'))
          setSearchParams({}, { replace: true })
          return
        }
        if (!txn.canSplit) {
          setError(t('Can only split a transaction within 2 days'))
          setSearchParams({}, { replace: true })
          return
        }
        setForm({
          ...emptyForm,
          title: (txn.description || txn.categoryName || t('Split bill')).replace(/^Split:\s*/i, ''),
          totalAmount: String(txn.amount),
          accountId: String(txn.accountId),
          categoryId: txn.categoryId ? String(txn.categoryId) : '',
          billDate: txn.txnDate,
          sourceTransactionId: txn.id,
          splitMode: 'percent',
          participants: [emptyParticipant()],
        })
        setFormOpen(true)
        setFromTxnNote(
          t('Splitting existing expense') + ` · ${money(txn.amount)} · ${txn.txnDate}`,
        )
        setError('')
        setSearchParams({}, { replace: true })
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t('Could not load transaction'))
      }
    })()
    return () => { cancelled = true }
  }, [searchParams, setSearchParams, t])

  function updateParticipant(index, field, value) {
    const participants = form.participants.map((p, i) => {
      if (i !== index) return p
      const next = { ...p, [field]: value }
      if (field === 'sharePercent' && total > 0) {
        const pct = Number(value)
        next.shareAmount = Number.isFinite(pct) && pct > 0 ? String(round2((total * pct) / 100)) : ''
      }
      if (field === 'shareAmount' && total > 0) {
        const amt = Number(value)
        next.sharePercent = Number.isFinite(amt) && amt > 0 ? String(round2((amt / total) * 100)) : ''
      }
      return next
    })
    setForm({ ...form, participants })
  }

  function addParticipantRow() {
    setForm({ ...form, participants: [...form.participants, emptyParticipant()] })
  }

  function removeParticipantRow(index) {
    setForm({ ...form, participants: form.participants.filter((_, i) => i !== index) })
  }

  function applyEqualSplit() {
    const n = form.participants.length + 1 // include you
    if (n < 2 || total <= 0) return
    const eachPct = round2(100 / n)
    // Give equal % to others; remainder stays as your share
    const participants = form.participants.map((p) => ({
      ...p,
      sharePercent: String(eachPct),
      shareAmount: String(round2((total * eachPct) / 100)),
    }))
    setForm({ ...form, splitMode: 'percent', participants })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (total <= 0) {
      setError(t('Enter a valid total amount'))
      return
    }
    if (computed.othersAmount >= total) {
      setError(t('Others’ shares leave nothing for you — lower their % or amounts'))
      return
    }
    if (computed.othersPercent >= 100) {
      setError(t('Percents must leave some share for you'))
      return
    }
    const participants = form.participants
      .filter((p) => p.name && (Number(p.shareAmount) > 0 || Number(p.sharePercent) > 0))
      .map((p) => {
        const pct = Number(p.sharePercent)
        const amt = form.splitMode === 'percent' && total > 0 && pct > 0
          ? round2((total * pct) / 100)
          : round2(p.shareAmount)
        return {
          name: p.name.trim(),
          shareAmount: amt,
          sharePercent: pct > 0 ? pct : (total > 0 ? round2((amt / total) * 100) : null),
          email: p.email || null,
        }
      })
    if (!participants.length) {
      setError(t('Add at least one person with a share'))
      return
    }
    try {
      await client.post('/split-bills', {
        title: form.title,
        totalAmount: total,
        accountId: form.sourceTransactionId
          ? null
          : (form.accountId ? Number(form.accountId) : null),
        billDate: form.billDate,
        note: form.note || null,
        sourceTransactionId: form.sourceTransactionId || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        participants,
      })
      setForm(emptyForm)
      setFormOpen(false)
      setFromTxnNote('')
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

  const unpaidOwed = owedBills.filter((b) => !b.paid)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Split a bill')}</h1>

      <section className="mb-6">
        <h2 className="font-semibold mb-2 text-sm text-slate-500 uppercase tracking-wide">
          {t('Split requests for you')} ({unpaidOwed.length})
        </h2>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {unpaidOwed.length === 0 && (
            <div className="p-4 text-sm text-slate-500">{t('No split bills you owe right now.')}</div>
          )}
          {unpaidOwed.map((b) => (
            <div key={b.participantId} className="p-4 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-medium">
                  {b.payerName} {t('wants')} {money(b.shareAmount)} {t('for')} "{b.title}"
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{t('Pay them, then they can mark collected')}</div>
              </div>
              {(b.upiPayLink || b.requesterUpiId) ? (
                <button
                  type="button"
                  disabled={payingId === b.participantId}
                  onClick={() => payOwedSplit(b)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                >
                  {payingId === b.participantId ? t('Opening…') : t('Pay via UPI')}
                </button>
              ) : (
                <span className="text-xs text-slate-500">{b.payerName} {t("hasn't added a UPI ID yet")}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <CollapsibleSection
        title={form.sourceTransactionId ? t('Split from transaction') : t('Split a bill')}
        addLabel={t('+ Add')}
        open={formOpen}
        onOpen={() => setFormOpen(true)}
      >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {fromTxnNote && (
          <div className="text-sm text-teal bg-teal/10 border border-teal/20 rounded-xl px-3 py-2">
            {fromTxnNote}
            <div className="text-xs text-slate-500 mt-1">
              {t('Your share will update this expense in Transactions. Friends’ shares stay pending until marked paid.')}
            </div>
          </div>
        )}

        <Field label={t('What was it for')}>
          <input required placeholder={t('What was it for')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full" />
        </Field>
        <Field label={t('Total amount')}>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            disabled={!!form.sourceTransactionId}
            placeholder={t('Total amount')}
            value={form.totalAmount}
            onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
            className="w-full disabled:opacity-70"
          />
        </Field>

        {!form.sourceTransactionId && (
          <Field label={t('Account')}>
            <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="w-full">
              <option value="">{t("Don't touch any account balance")}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {t('With an account selected, your share is saved automatically in Transactions.')}
            </p>
          </Field>
        )}

        <Field label={t('Bill date')}>
          <input
            type="date"
            required
            disabled={!!form.sourceTransactionId}
            value={form.billDate}
            onChange={(e) => setForm({ ...form, billDate: e.target.value })}
            className="w-full disabled:opacity-70"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold text-muted">{t('Split by')}</span>
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setForm({ ...form, splitMode: 'percent' })}
              className={`px-3 py-1.5 font-medium ${form.splitMode === 'percent' ? 'bg-brand-500 text-white' : 'bg-white text-slate-600'}`}
            >
              {t('Percent %')}
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, splitMode: 'amount' })}
              className={`px-3 py-1.5 font-medium ${form.splitMode === 'amount' ? 'bg-brand-500 text-white' : 'bg-white text-slate-600'}`}
            >
              {t('Amount ₹')}
            </button>
          </div>
          <button type="button" onClick={applyEqualSplit} className="text-sm text-brand-600 font-medium ml-auto">
            {t('Equal split')}
          </button>
        </div>

        <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2 text-sm">
          <div className="font-semibold text-brand-700">
            {t('Your share')}: {money(computed.yourShare)}
            {total > 0 ? ` (${computed.yourPercent}%)` : ''}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {t('Others')}: {money(computed.othersAmount)}
            {total > 0 ? ` (${computed.othersPercent}%)` : ''}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-[13px] font-bold text-muted">{t('Who owes what')}</div>
          {form.participants.map((p, i) => (
            <div key={i} className="bg-slate-50 rounded-2xl p-3 flex flex-col gap-2">
              <input placeholder={t('Name')} value={p.name} onChange={(e) => updateParticipant(i, 'name', e.target.value)} className="w-full" />
              {form.splitMode === 'percent' ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="99.99"
                    placeholder={t('Their %')}
                    value={p.sharePercent}
                    onChange={(e) => updateParticipant(i, 'sharePercent', e.target.value)}
                    className="w-full"
                  />
                  <span className="text-sm text-slate-500 shrink-0 w-24 text-right">
                    {p.shareAmount ? money(p.shareAmount) : '—'}
                  </span>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={t('Their share')}
                    value={p.shareAmount}
                    onChange={(e) => updateParticipant(i, 'shareAmount', e.target.value)}
                    className="w-full"
                  />
                  <span className="text-sm text-slate-500 shrink-0 w-16 text-right">
                    {p.sharePercent ? `${p.sharePercent}%` : '—'}
                  </span>
                </div>
              )}
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
          <button
            type="button"
            onClick={() => {
              setFormOpen(false)
              setFromTxnNote('')
              setForm(emptyForm)
            }}
            className="px-4 py-2 rounded-md border border-slate-300"
          >
            {t('Cancel')}
          </button>
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
                  {bill.yourSharePercent != null ? ` (${bill.yourSharePercent}%)` : ''}
                  {bill.accountName ? ` · ${bill.accountName}` : ''}
                  {bill.sourceTransactionId ? ` · ${t('from transaction')}` : ''}
                  {bill.expenseTransactionId ? ` · ${t('in Transactions')}` : ''}
                  {bill.note ? ` · ${bill.note}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-emerald-600 font-medium">{money(bill.collected)} {t('collected')}</span>
                  {Number(bill.pending) > 0 && <span className="text-slate-500"> · {money(bill.pending)} {t('pending')}</span>}
                </div>
                {bill.expenseTransactionId && (
                  <Link to="/transactions" className="text-sm text-brand-600 font-medium">{t('View')}</Link>
                )}
                <button onClick={() => handleDelete(bill.id)} className="text-sm text-red-600">{t('Delete')}</button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 divide-y divide-slate-100">
              {bill.participants.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    {p.name}
                    {p.sharePercent != null && (
                      <span className="ml-2 text-xs text-slate-500">{Number(p.sharePercent)}%</span>
                    )}
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
