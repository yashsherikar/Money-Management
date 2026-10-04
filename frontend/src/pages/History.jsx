import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import client, { networkErrorMessage } from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import { buildHistoryInsights } from '../utils/historyInsights.js'

const RANGES = [
  { id: 3, label: '3M' },
  { id: 6, label: '6M' },
  { id: 12, label: '12M' },
  { id: 999, label: 'All' },
]

const CAT_COLORS = ['#2F7BFF', '#2EE6C8', '#F5A524', '#FF5B7A', '#5B9BFF', '#38BDF8', '#A3E635', '#FB7185']

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function moneyExact(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="history-tooltip">
      <div className="history-tooltip-label">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="history-tooltip-row">
          <span style={{ color: p.color || p.fill }}>{p.name}</span>
          <strong>{moneyExact(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function History() {
  const { t } = useLanguage()
  const [months, setMonths] = useState(12)
  const [reloadTick, setReloadTick] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    async function load() {
      try {
        const res = await client.get('/history/insights', { params: { months } })
        if (!cancelled) setData(res.data)
        return
      } catch (err) {
        const status = err?.response?.status
        // Older Render deploy may not have /history/insights yet → build from txns
        if (status === 404 || status === 405 || status === 501) {
          try {
            const tx = await client.get('/transactions')
            if (!cancelled) setData(buildHistoryInsights(tx.data || [], months))
            return
          } catch (fallbackErr) {
            if (!cancelled) {
              setData(null)
              setError(networkErrorMessage(fallbackErr, t('Could not load history')))
            }
            return
          }
        }
        if (!cancelled) {
          setData(null)
          setError(networkErrorMessage(err, t('Could not load history')))
        }
      }
    }

    load().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [months, reloadTick, t])

  const chartMonths = useMemo(() => (data?.monthly || []).map((m) => ({
    ...m,
    income: Number(m.income || 0),
    expense: Number(m.expense || 0),
    savings: Number(m.savings || 0),
  })), [data])

  const pieData = useMemo(() => (data?.byCategory || [])
    .filter((c) => Number(c.amount) > 0)
    .slice(0, 8)
    .map((c) => ({ name: c.categoryName, value: Number(c.amount) })), [data])

  const topMerchants = data?.topMerchants || []
  const maxMerchant = Math.max(...topMerchants.map((m) => Number(m.amount || 0)), 1)

  return (
    <div className="history-page page-stack">
      <header className="history-hero">
        <div className="relative z-[1]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1">
            {t('Spending history')}
          </p>
          <h1 className="text-[clamp(1.45rem,1.2rem+1.4vw,1.9rem)] font-bold tracking-tight text-slate-900 leading-tight">
            {t('Where your money went')}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-md">
            {t('All months stay saved — explore spend patterns, top places, and categories.')}
          </p>
        </div>

        <div className="relative z-[1] flex flex-wrap gap-1.5 mt-4" role="tablist" aria-label={t('Time range')}>
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={months === r.id}
              onClick={() => setMonths(r.id)}
              className={`history-range-btn ${months === r.id ? 'history-range-btn-on' : ''}`}
            >
              {t(r.label === 'All' ? 'All' : r.label)}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" className="px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium" onClick={() => setReloadTick((n) => n + 1)}>
            {t('Retry')}
          </button>
        </div>
      )}

      {loading && !data && <div className="text-slate-500 py-8">{t('Loading...')}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="history-stat">
              <div className="history-stat-label">{t('Spent')}</div>
              <div className="history-stat-value text-red-600">{money(data.totalExpense)}</div>
            </div>
            <div className="history-stat">
              <div className="history-stat-label">{t('Income')}</div>
              <div className="history-stat-value text-emerald-600">{money(data.totalIncome)}</div>
            </div>
            <div className="history-stat">
              <div className="history-stat-label">{t('Net saved')}</div>
              <div className={`history-stat-value ${Number(data.totalSavings) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {money(data.totalSavings)}
              </div>
            </div>
            <div className="history-stat">
              <div className="history-stat-label">{t('Top place')}</div>
              <div className="history-stat-value text-slate-900 text-[clamp(0.95rem,0.85rem+0.6vw,1.15rem)] truncate" title={data.topMerchant || ''}>
                {data.topMerchant || '—'}
              </div>
              {data.topMerchant && (
                <div className="text-[0.7rem] text-slate-500 mt-0.5">{money(data.topMerchantAmount)}</div>
              )}
            </div>
          </div>

          {(data.peakSpendMonth || data.topMerchant) && (
            <div className="history-insight">
              {data.peakSpendMonth && (
                <span>
                  {t('Highest spend month')}: <strong>{data.peakSpendMonth}</strong> · {money(data.peakSpendAmount)}
                </span>
              )}
              {data.topMerchant && (
                <span>
                  {t('You paid most at')} <strong>{data.topMerchant}</strong>
                </span>
              )}
            </div>
          )}

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-end justify-between gap-2 mb-3">
              <div>
                <h2 className="font-semibold text-slate-900">{t('Month by month')}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{t('Bars = spend · line = income')}</p>
              </div>
            </div>
            {chartMonths.every((m) => m.expense === 0 && m.income === 0) ? (
              <div className="text-sm text-slate-500 py-10 text-center">{t('No transactions in this range yet.')}</div>
            ) : (
              <div className="history-chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={chartMonths} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="histSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF5B7A" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#FF5B7A" stopOpacity={0.45} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#8B98AD', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#5E6E84', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(47,123,255,0.06)' }} />
                    <Bar dataKey="expense" name={t('Spent')} fill="url(#histSpend)" radius={[8, 8, 4, 4]} maxBarSize={28} />
                    <Line type="monotone" dataKey="income" name={t('Income')} stroke="#2EE6C8" strokeWidth={2.4} dot={{ r: 3, fill: '#2EE6C8', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-semibold text-slate-900 mb-1">{t('By category')}</h2>
            <p className="text-xs text-slate-500 mb-3">{t('Where spend clustered in this range')}</p>
            {pieData.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center">{t('No category spend yet.')}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2 items-center">
                <div className="history-chart-wrap h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2.5} stroke="none">
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => moneyExact(v)} contentStyle={{ background: '#1C2436', border: 'none', borderRadius: 12, color: '#F3F6FA' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2.5 min-w-0">
                  {(data.byCategory || []).slice(0, 6).map((c, i) => (
                    <li key={c.categoryId ?? c.categoryName} className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                      <span className="text-sm text-slate-700 truncate flex-1">{c.categoryName}</span>
                      <span className="text-xs font-semibold tabular-nums text-slate-500 shrink-0">{c.percent}%</span>
                      <span className="text-sm font-bold tabular-nums text-slate-900 shrink-0">{money(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-semibold text-slate-900 mb-1">{t('Where you paid most')}</h2>
            <p className="text-xs text-slate-500 mb-4">{t('Merchants & people ranked by total spend')}</p>
            {topMerchants.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center">{t('No payee history yet. Pay via QR or SMS to build this list.')}</div>
            ) : (
              <ol className="space-y-3.5">
                {topMerchants.map((m, i) => {
                  const pct = Math.max(4, (Number(m.amount) / maxMerchant) * 100)
                  return (
                    <li key={m.name} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="history-rank">{i + 1}</span>
                          <span className="text-sm font-semibold text-slate-900 truncate">{m.name}</span>
                          <span className="text-[0.7rem] text-slate-500 shrink-0">{m.txnCount}×</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-slate-900 shrink-0">{moneyExact(m.amount)}</span>
                      </div>
                      <div className="history-bar-track">
                        <div className="history-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  )
}
