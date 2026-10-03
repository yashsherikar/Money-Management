import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import client, { networkErrorMessage } from '../api/client'
import StatCard from '../components/StatCard.jsx'
import MoneyRow from '../components/MoneyRow.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { countWaitingP2pPays } from '../utils/pendingP2pPays.js'
import { scanInboxForPendingPays, isSmsPaySupported } from '../utils/smsPayWatch.js'
import { brandFromTxnText, MerchantLogo } from '../utils/subscriptionBrands.jsx'

const COLORS = ['#226DFF', '#00F5D4', '#f59e0b', '#FF5376', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const { t } = useLanguage()
  const [summary, setSummary] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [waitingPays, setWaitingPays] = useState(() => countWaitingP2pPays())

  function load() {
    setLoadError('')
    setSummary(null)
    client.get('/dashboard/summary')
      .then((res) => setSummary(res.data))
      .catch((err) => setLoadError(networkErrorMessage(err, 'Failed to load dashboard')))
  }

  useEffect(() => {
    load()
    const onRefresh = () => load()
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

  if (loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 mb-4">{loadError}</p>
        <button type="button" onClick={load} className="px-4 py-2 bg-brand-600 text-white rounded-md">
          Retry
        </button>
      </div>
    )
  }

  if (!summary) return <div className="text-slate-500">{t('Loading...')}</div>

  const chartData = summary.expenseByCategory
    .filter((c) => Number(c.amount) > 0)
    .map((c) => ({ name: c.categoryName, value: Number(c.amount) }))

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">{t('Dashboard')}</h1>
        <Link
          to="/pay"
          className="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-4 py-2.5 text-sm font-semibold"
        >
          {t('Pay')}
        </Link>
      </div>

      {waitingPays > 0 && (
        <Link
          to="/pending-pays"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-amber-500/10 border border-amber-500/25"
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label={t('Income')} value={money(summary.totalIncome)} tone="good" />
        <StatCard label={t('Expense')} value={money(summary.totalExpense)} tone="bad" />
        <StatCard
          label={t('Savings')}
          value={money(summary.savings)}
          sub={`${summary.savingsRatePercent}% ${t('of income')}`}
          tone={Number(summary.savings) >= 0 ? 'good' : 'bad'}
        />
        <StatCard
          label={t('vs Last Month')}
          value={`${Number(summary.savingsChangePercent) >= 0 ? '+' : ''}${summary.savingsChangePercent}%`}
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
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(v)} contentStyle={{ background: '#1F293A', border: 'none', borderRadius: 8, color: '#F1F5F9' }} />
                <Legend wrapperStyle={{ color: '#8A99AD' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold mb-1">{t('Money wasted this month')}</h2>
          <p className="text-sm text-slate-500 mb-4">
            {t('Non-essential spending (recurring payments are excluded), total')} {money(summary.unwantedExpenseTotal)}
          </p>
          {summary.unwantedExpenses.length === 0 ? (
            <div className="text-sm text-slate-500">{t('Nothing flagged. Nice.')}</div>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-4 -mb-4">
              {summary.unwantedExpenses.map((u) => {
                const brand = brandFromTxnText(u.description, u.categoryName)
                return (
                  <MoneyRow
                    key={u.transactionId}
                    title={brand?.name || u.description || u.categoryName}
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
