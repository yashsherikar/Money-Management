import { useEffect, useState } from 'react'
import client from '../api/client'
import StatCard from '../components/StatCard.jsx'
import Field from '../components/Field.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function pct(n, t) {
  return n === null || n === undefined ? t('N/A') : `${Number(n).toFixed(2)}%`
}

const emptyForm = { name: '', type: 'MUTUAL_FUND', note: '' }
const emptyTxnForm = { txnDate: new Date().toISOString().slice(0, 10), type: 'BUY', amount: '' }

export default function Investments() {
  const { t } = useLanguage()
  const [investments, setInvestments] = useState([])
  const [summary, setSummary] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [txnForms, setTxnForms] = useState({}) // investmentId -> form
  const [valueDrafts, setValueDrafts] = useState({}) // investmentId -> string

  async function loadAll() {
    const [invRes, summaryRes] = await Promise.all([client.get('/investments'), client.get('/investments/summary')])
    setInvestments(invRes.data)
    setSummary(summaryRes.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    try {
      await client.post('/investments', { name: form.name, type: form.type, note: form.note || null })
      setForm(emptyForm)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this investment and all its transactions?'))) return
    await client.delete(`/investments/${id}`)
    loadAll()
  }

  function txnForm(id) {
    return txnForms[id] || emptyTxnForm
  }

  async function handleAddTxn(id) {
    const f = txnForm(id)
    if (!f.amount) return
    await client.post(`/investments/${id}/transactions`, { txnDate: f.txnDate, type: f.type, amount: Number(f.amount) })
    setTxnForms({ ...txnForms, [id]: emptyTxnForm })
    loadAll()
  }

  async function handleDeleteTxn(txnId) {
    await client.delete(`/investments/transactions/${txnId}`)
    loadAll()
  }

  async function handleSaveValue(id) {
    const v = valueDrafts[id]
    if (v === undefined || v === '') return
    await client.put(`/investments/${id}/current-value`, { currentValue: Number(v) })
    setValueDrafts({ ...valueDrafts, [id]: undefined })
    loadAll()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Investments')}</h1>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label={t('Invested')} value={money(summary.totalInvested)} />
          <StatCard label={t('Current value')} value={money(summary.totalCurrentValue)} />
          <StatCard label={t('Gain')} value={money(summary.overallGain)} tone={Number(summary.overallGain) >= 0 ? 'good' : 'bad'} />
          <StatCard label={t('Overall XIRR')} value={pct(summary.overallXirrPercent, t)} />
        </div>
      )}

      <form onSubmit={handleAdd} className="bg-white rounded-xl p-5 mb-6 flex flex-col gap-4">
        <Field label={t('Name (fund / stock / SIP)')}>
          <input required placeholder={t('Name (fund / stock / SIP)')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full" />
        </Field>
        <Field label={t('Type')}>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full">
            <option value="MUTUAL_FUND">{t('MUTUAL_FUND')}</option>
            <option value="STOCK">{t('STOCK')}</option>
            <option value="SIP">{t('SIP')}</option>
            <option value="RD">{t('RD')}</option>
            <option value="OTHER">{t('OTHER')}</option>
          </select>
        </Field>
        <Field label={t('Note (optional)')}>
          <input placeholder={t('Note (optional)')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full" />
        </Field>
        <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">{t('Add investment')}</button>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>

      <div className="space-y-4">
        {investments.length === 0 && <div className="text-sm text-slate-500">{t('No investments tracked yet.')}</div>}
        {investments.map((inv) => {
          const f = txnForm(inv.id)
          return (
            <div key={inv.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold">{inv.name} <span className="text-xs text-slate-500 font-normal">{t(inv.type)}</span></div>
                  <div className="text-xs text-slate-500">
                    {t('Invested')} {money(inv.totalInvested)} · {t('Redeemed')} {money(inv.totalRedeemed)} · {t('Gain')}{' '}
                    <span className={Number(inv.gain) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{money(inv.gain)}</span>
                    {' '}· {t('XIRR')} {pct(inv.xirrPercent, t)}{inv.note ? ` · ${inv.note}` : ''}
                  </div>
                </div>
                <button onClick={() => handleDelete(inv.id)} className="text-sm text-red-600">{t('Delete')}</button>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm">
                <span className="text-slate-600">{t('Current value:')}</span>
                <span className="font-medium">{money(inv.currentValue)}</span>
                <input
                  type="number" step="0.01" min="0" placeholder={t('Update value')}
                  value={valueDrafts[inv.id] ?? ''}
                  onChange={(e) => setValueDrafts({ ...valueDrafts, [inv.id]: e.target.value })}
                  className="px-2 py-1 border border-slate-300 rounded-md w-32"
                />
                <button onClick={() => handleSaveValue(inv.id)} className="text-brand-600">{t('Save')}</button>
              </div>

              <div className="mt-3 divide-y divide-slate-100">
                {inv.transactions.map((txn) => (
                  <div key={txn.id} className="py-2 flex items-center justify-between text-sm">
                    <span>{txn.txnDate} · {txn.type === 'BUY' ? t('Invested') : t('Redeemed')}</span>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${txn.type === 'BUY' ? 'text-red-600' : 'text-emerald-600'}`}>{money(txn.amount)}</span>
                      <button onClick={() => handleDeleteTxn(txn.id)} className="text-red-600">{t('Delete')}</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <input type="date" value={f.txnDate} onChange={(e) => setTxnForms({ ...txnForms, [inv.id]: { ...f, txnDate: e.target.value } })} className="px-2 py-1 border border-slate-300 rounded-md" />
                <select value={f.type} onChange={(e) => setTxnForms({ ...txnForms, [inv.id]: { ...f, type: e.target.value } })} className="px-2 py-1 border border-slate-300 rounded-md">
                  <option value="BUY">{t('Invested (buy / SIP installment)')}</option>
                  <option value="SELL">{t('Redeemed (sell)')}</option>
                </select>
                <input type="number" step="0.01" min="0.01" placeholder={t('Amount')} value={f.amount} onChange={(e) => setTxnForms({ ...txnForms, [inv.id]: { ...f, amount: e.target.value } })} className="px-2 py-1 border border-slate-300 rounded-md w-32" />
                <button onClick={() => handleAddTxn(inv.id)} className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium">{t('Add')}</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
