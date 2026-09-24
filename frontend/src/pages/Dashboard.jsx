import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import client from '../api/client'
import StatCard from '../components/StatCard.jsx'
import { categoryIcon } from '../utils/categoryIcon.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const COLORS = ['#226DFF', '#00F5D4', '#f59e0b', '#FF5376', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const { t } = useLanguage()
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    client.get('/dashboard/summary').then((res) => setSummary(res.data))
  }, [])

  if (!summary) return <div className="text-slate-500">{t('Loading...')}</div>

  const chartData = summary.expenseByCategory
    .filter((c) => Number(c.amount) > 0)
    .map((c) => ({ name: c.categoryName, value: Number(c.amount) }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Dashboard')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
          <p className="text-sm text-slate-500 mb-4">{t('Non-essential spending, total')} {money(summary.unwantedExpenseTotal)}</p>
          {summary.unwantedExpenses.length === 0 ? (
            <div className="text-sm text-slate-500">{t('Nothing flagged. Nice.')}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {summary.unwantedExpenses.map((u) => (
                <div key={u.transactionId} className="py-2 flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{categoryIcon(`${u.description || ''} ${u.categoryName || ''}`, 'EXPENSE')}</span>
                    <div>
                      <div className="font-medium">{u.description || u.categoryName}</div>
                      <div className="text-xs text-slate-500">{u.categoryName}</div>
                    </div>
                  </div>
                  <div className="font-semibold text-red-600">{money(u.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
