import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import client, { networkErrorMessage } from '../api/client'
import StatCard from '../components/StatCard.jsx'
import MoneyRow from '../components/MoneyRow.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { countWaitingP2pPays } from '../utils/pendingP2pPays.js'
import { scanInboxForPendingPays, isSmsPaySupported } from '../utils/smsPayWatch.js'
import { brandFromTxnText, MerchantLogo } from '../utils/subscriptionBrands.jsx'

const COLORS = ['#2F7BFF', '#2EE6C8', '#F5A524', '#FF5B7A', '#5B9BFF', '#38BDF8', '#F472B6', '#A3E635']

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const { t } = useLanguage()
  const [summary, setSummary] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [waitingPays, setWaitingPays] = useState(() => countWaitingP2pPays())
  const reqId = useRef(0)

  function load({ soft = false } = {}) {
    setLoadError('')
    if (!soft) setSummary(null)
    const id = ++reqId.current
    client.get('/dashboard/summary')
      .then((res) => {
        if (id !== reqId.current) return
        setSummary(res.data)
      })
      .catch((err) => {
        if (id !== reqId.current) return
        setLoadError(networkErrorMessage(err, 'Failed to load dashboard'))
      })
  }

  useEffect(() => {
    load()
    const onRefresh = () => load({ soft: true })
    const onPending = () => setWaitingPays(countWaitingP2pPays())
    window.addEventListener('mm-transactions-changed', onRefresh)
    window.addEventListener('mm-pending-p2p-changed', onPending)
    window.addEventListener('mm-p2p-sms-confirmed', onPending)
    if (isSmsPaySupported() && countWaitingP2pPays() > 0) {
      scanInboxForPendingPays().then(() => setWaitingPays(countWaitingP2pPays()))
    }
    return () => {
      window.removeEventListener('mm-transactions-changed', onRefresh)
      window.removeEventListener('mm-pending-p2p-changed', onPending)
      window.removeEventListener('mm-p2p-sms-confirmed', onPending)
    }
  }, [])

  if (loadError && !summary) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 mb-4">{loadError}</p>
        <button type="button" onClick={() => load()} className="px-4 py-2 bg-brand-600 text-white rounded-md">
          Retry
        </button>
      </div>
    )
  }

  if (!summary) return <div className="text-slate-500">{t('Loading...')}</div>

  const expenseByCategory = summary.expenseByCategory ?? []
  const unwantedExpenses = summary.unwantedExpenses ?? []
  const chartData = expenseByCategory
    .filter((c) => Number(c.amount) > 0)
    .map((c) => ({ name: c.categoryName, value: Number(c.amount) }))

  return (
    <div className="page-stack">
      <div className="hero-balance">
        <div className="relative z-[1] min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('This month')}
            </div>
            <Link to="/history" className="text-xs font-semibold text-brand-700 hover:underline shrink-0">
              {t('History')}
            </Link>
          </div>
          <div className="mt-1.5 text-[clamp(1.75rem,1.35rem+2.2vw,2.35rem)] font-bold tracking-tight leading-none text-slate-900">
            {money(summary.savings)}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {summary.savingsRatePercent ?? 0}% {t('of income saved')} · {t('Primary bank only — all accounts on Transactions')}
          </p>
        </div>
        <div className="relative z-[1] mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-black/20 px-3 py-2.5 border border-white/5">
            <div className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-semibold">{t('Income')}</div>
            <div className="mt-0.5 text-sm font-bold text-emerald-600 tabular-nums">{money(summary.totalIncome)}</div>
          </div>
          <div className="rounded-2xl bg-black/20 px-3 py-2.5 border border-white/5">
            <div className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-semibold">{t('Expense')}</div>
            <div className="mt-0.5 text-sm font-bold text-red-600 tabular-nums">{money(summary.totalExpense)}</div>
          </div>
        </div>
      </div>

      {waitingPays > 0 && (
        <Link
          to="/pending-pays"
          className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 bg-amber-500/10 border border-amber-500/25"
        >
          <div>
            <div className="text-sm font-semibold text-amber-500">
              {waitingPays} {t('P2P pay(s) waiting for bank SMS')}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {t('Late SMS is OK — tap to check status')}
            </div>
          </div>
          <span className="text-amber-500 text-sm font-medium shrink-0">{t('Open')} →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label={t('Income')} value={money(summary.totalIncome)} tone="good" />
        <StatCard label={t('Expense')} value={money(summary.totalExpense)} tone="bad" />
        <StatCard
          label={t('Savings')}
          value={money(summary.savings)}
          sub={`${summary.savingsRatePercent ?? 0}% ${t('of income')}`}
          tone={Number(summary.savings) >= 0 ? 'good' : 'bad'}
        />
        <StatCard
          label={t('vs Last Month')}
          value={`${Number(summary.savingsChangePercent) >= 0 ? '+' : ''}${summary.savingsChangePercent ?? 0}%`}
          sub={`${t('was')} ${money(summary.lastMonthSavings)}`}
          tone={Number(summary.savingsChangePercent) >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold mb-4">{t('Spending by category')}</h2>
          {chartData.length === 0 ? (
            <div className="text-sm text-slate-500">{t('No expenses logged this month yet.')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={48} paddingAngle={2} label={false}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(v)} contentStyle={{ background: '#1C2436', border: 'none', borderRadius: 12, color: '#F3F6FA' }} />
                <Legend wrapperStyle={{ color: '#8B98AD' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold mb-1">{t('Money wasted this month')}</h2>
          <p className="text-sm text-slate-500 mb-4">
            {t('Non-essential spending (recurring payments are excluded), total')} {money(summary.unwantedExpenseTotal)}
          </p>
          {unwantedExpenses.length === 0 ? (
            <div className="text-sm text-slate-500">{t('Nothing flagged. Nice.')}</div>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-4 -mb-4">
              {unwantedExpenses.map((u) => {
                const brand = brandFromTxnText(u.description, u.categoryName)
                return (
                  <MoneyRow
                    key={u.transactionId}
                    title={u.description || u.categoryName}
                    meta={u.categoryName}
                    amount={u.amount}
                    type="EXPENSE"
                    icon={brand ? <MerchantLogo brand={brand} size={40} /> : null}
                    iconText={brand ? undefined : `${u.description || ''} ${u.categoryName || ''}`}
                  />
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
