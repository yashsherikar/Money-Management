import { useEffect, useState } from 'react'
import client from '../api/client'
import StatCard from '../components/StatCard.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

const TABS = ['EMI', 'Fixed Deposits', 'Insurance']

const emiEmpty = { accountId: '', loanName: '', principal: '', interestRate: '', tenureMonths: '', emiAmount: '', startDate: new Date().toISOString().slice(0, 10), dueDay: '5' }
const fdEmpty = { bankName: '', principal: '', interestRate: '', startDate: new Date().toISOString().slice(0, 10), maturityDate: '', maturityAmount: '' }
const insEmpty = { type: 'HEALTH', policyName: '', premiumAmount: '', dueDate: '', frequency: 'YEARLY' }

export default function Obligations() {
  const { t } = useLanguage()
  const [tab, setTab] = useState('EMI')
  const [summary, setSummary] = useState(null)
  const [accounts, setAccounts] = useState([])

  const [emiForm, setEmiForm] = useState(emiEmpty)
  const [fdForm, setFdForm] = useState(fdEmpty)
  const [insForm, setInsForm] = useState(insEmpty)
  const [error, setError] = useState('')

  async function load() {
    const [obRes, accRes] = await Promise.all([client.get('/obligations/summary'), client.get('/accounts')])
    setSummary(obRes.data)
    setAccounts(accRes.data)
    const primary = accRes.data.find((a) => a.isPrimary) || accRes.data[0]
    if (primary) setEmiForm((f) => (f.accountId ? f : { ...f, accountId: String(primary.id) }))
  }

  useEffect(() => {
    load()
  }, [])

  async function submitEmi(e) {
    e.preventDefault()
    setError('')
    try {
      await client.post('/emis', {
        accountId: Number(emiForm.accountId),
        loanName: emiForm.loanName,
        principal: Number(emiForm.principal),
        interestRate: Number(emiForm.interestRate),
        tenureMonths: Number(emiForm.tenureMonths),
        emiAmount: Number(emiForm.emiAmount),
        startDate: emiForm.startDate,
        dueDay: Number(emiForm.dueDay),
      })
      setEmiForm(emiEmpty)
      load()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function submitFd(e) {
    e.preventDefault()
    setError('')
    try {
      await client.post('/fixed-deposits', {
        bankName: fdForm.bankName,
        principal: Number(fdForm.principal),
        interestRate: Number(fdForm.interestRate),
        startDate: fdForm.startDate,
        maturityDate: fdForm.maturityDate,
        maturityAmount: Number(fdForm.maturityAmount),
      })
      setFdForm(fdEmpty)
      load()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function submitIns(e) {
    e.preventDefault()
    setError('')
    try {
      await client.post('/insurance-policies', {
        type: insForm.type,
        policyName: insForm.policyName,
        premiumAmount: Number(insForm.premiumAmount),
        dueDate: insForm.dueDate,
        frequency: insForm.frequency,
      })
      setInsForm(insEmpty)
      load()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function toggleEmiActive(e) { await client.patch(`/emis/${e.id}/active?active=${!e.active}`); load() }
  async function deleteEmi(id) { await client.delete(`/emis/${id}`); load() }
  async function deleteFd(id) { await client.delete(`/fixed-deposits/${id}`); load() }
  async function deleteIns(id) { await client.delete(`/insurance-policies/${id}`); load() }

  if (!summary) return <div className="text-slate-500">Loading...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Obligations')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label={t('Monthly EMI outgo')} value={money(summary.totalMonthlyEmi)} />
        <StatCard label={t('Monthly income')} value={money(summary.totalMonthlyIncome)} />
        <StatCard
          label={t('EMI-to-income ratio')}
          value={`${summary.emiToIncomeRatioPercent}%`}
          sub={summary.emiRatioHealthy ? t('Healthy (≤40%)') : t('Flagged: above 40%')}
          tone={summary.emiRatioHealthy ? 'good' : 'bad'}
        />
      </div>

      <div className="flex gap-2 mb-4 border-b border-slate-200">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === tb ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500'}`}
          >
            {t(tb)}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      {tab === 'EMI' && (
        <div>
          <form onSubmit={submitEmi} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
            <select required value={emiForm.accountId} onChange={(e) => setEmiForm({ ...emiForm, accountId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
              <option value="">{t('Debit from account...')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input required placeholder={t('Loan name')} value={emiForm.loanName} onChange={(e) => setEmiForm({ ...emiForm, loanName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="number" step="0.01" placeholder={t('Principal')} value={emiForm.principal} onChange={(e) => setEmiForm({ ...emiForm, principal: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="number" step="0.01" placeholder={t('Interest rate %')} value={emiForm.interestRate} onChange={(e) => setEmiForm({ ...emiForm, interestRate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="number" placeholder={t('Tenure (months)')} value={emiForm.tenureMonths} onChange={(e) => setEmiForm({ ...emiForm, tenureMonths: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="number" step="0.01" placeholder={t('EMI amount')} value={emiForm.emiAmount} onChange={(e) => setEmiForm({ ...emiForm, emiAmount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="date" value={emiForm.startDate} onChange={(e) => setEmiForm({ ...emiForm, startDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="number" min="1" max="28" placeholder={t('Due day (1-28)')} value={emiForm.dueDay} onChange={(e) => setEmiForm({ ...emiForm, dueDay: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium md:col-span-4">{t('Add EMI')}</button>
          </form>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {summary.emis.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No EMIs tracked.')}</div>}
            {summary.emis.map((e) => (
              <div key={e.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{e.loanName}</div>
                  <div className="text-xs text-slate-500">{e.tenureMonths} {t('months')} · {t('due day')} {e.dueDay} · {t(e.active ? 'active' : 'inactive')}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="font-semibold">{money(e.emiAmount)}/{t('mo')}</div>
                  <button onClick={() => toggleEmiActive(e)} className="text-sm text-brand-600">{e.active ? t('Pause') : t('Resume')}</button>
                  <button onClick={() => deleteEmi(e.id)} className="text-sm text-red-600">{t('Delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Fixed Deposits' && (
        <div>
          <form onSubmit={submitFd} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input required placeholder={t('Bank name')} value={fdForm.bankName} onChange={(e) => setFdForm({ ...fdForm, bankName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="number" step="0.01" placeholder={t('Principal')} value={fdForm.principal} onChange={(e) => setFdForm({ ...fdForm, principal: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="number" step="0.01" placeholder={t('Interest rate %')} value={fdForm.interestRate} onChange={(e) => setFdForm({ ...fdForm, interestRate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="date" value={fdForm.startDate} onChange={(e) => setFdForm({ ...fdForm, startDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="date" placeholder={t('Maturity date')} value={fdForm.maturityDate} onChange={(e) => setFdForm({ ...fdForm, maturityDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="number" step="0.01" placeholder={t('Maturity amount')} value={fdForm.maturityAmount} onChange={(e) => setFdForm({ ...fdForm, maturityAmount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium md:col-span-3">{t('Add FD')}</button>
          </form>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {summary.fixedDeposits.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No fixed deposits tracked.')}</div>}
            {summary.fixedDeposits.map((fd) => (
              <div key={fd.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{fd.bankName}</div>
                  <div className="text-xs text-slate-500">{t('Matures')} {fd.maturityDate} {fd.maturingSoon && <span className="text-amber-600 font-medium">· {t('maturing soon')}</span>}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="font-semibold">{money(fd.maturityAmount)}</div>
                  <button onClick={() => deleteFd(fd.id)} className="text-sm text-red-600">{t('Delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Insurance' && (
        <div>
          <form onSubmit={submitIns} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={insForm.type} onChange={(e) => setInsForm({ ...insForm, type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
              <option value="HEALTH">{t('HEALTH')}</option>
              <option value="LIFE">{t('LIFE')}</option>
              <option value="VEHICLE">{t('VEHICLE')}</option>
            </select>
            <input required placeholder={t('Policy name')} value={insForm.policyName} onChange={(e) => setInsForm({ ...insForm, policyName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="number" step="0.01" placeholder={t('Premium amount')} value={insForm.premiumAmount} onChange={(e) => setInsForm({ ...insForm, premiumAmount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="date" placeholder={t('Due date')} value={insForm.dueDate} onChange={(e) => setInsForm({ ...insForm, dueDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <select value={insForm.frequency} onChange={(e) => setInsForm({ ...insForm, frequency: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
              <option value="MONTHLY">{t('MONTHLY')}</option>
              <option value="QUARTERLY">{t('QUARTERLY')}</option>
              <option value="HALF_YEARLY">{t('HALF_YEARLY')}</option>
              <option value="YEARLY">{t('YEARLY')}</option>
            </select>
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium">{t('Add policy')}</button>
          </form>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {summary.insurancePolicies.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No policies tracked.')}</div>}
            {summary.insurancePolicies.map((p) => (
              <div key={p.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{p.policyName}</div>
                  <div className="text-xs text-slate-500">{t(p.type)} · {t(p.frequency)} · {t('due')} {p.dueDate} {p.dueSoon && <span className="text-amber-600 font-medium">· {t('due soon')}</span>}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="font-semibold">{money(p.premiumAmount)}</div>
                  <button onClick={() => deleteIns(p.id)} className="text-sm text-red-600">{t('Delete')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
