import { useEffect, useState } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

export default function DueReminders() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [dismissed, setDismissed] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!user) return
    client.get('/recurring-transactions/due').then((res) => setItems(res.data)).catch(() => {})
  }, [user?.id])

  async function confirmPaid(id) {
    await client.post(`/recurring-transactions/${id}/confirm`)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (!user || dismissed || items.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg">{t('Did you pay these?')}</h2>
          <button onClick={() => setDismissed(true)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">{t("These are due this month and haven't been confirmed yet.")}</p>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{item.description}</div>
                <div className="font-semibold">{money(item.amount)}</div>
              </div>
              <div className="text-xs text-slate-500 mb-2">{t('Due day')} {item.dayOfMonth} {t('of this month')}</div>

              {expandedId === item.id && (
                <div className="text-sm text-slate-600 bg-slate-50 rounded p-2 mb-2 space-y-0.5">
                  <div>{t('From/to:')} {item.description}</div>
                  <div>{t('Account:')} {item.accountName}</div>
                  {item.categoryName && <div>{t('Category:')} {item.categoryName}</div>}
                  <div>{t('Type:')} {item.type === 'INCOME' ? t('Money in') : t('Money out')}</div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => confirmPaid(item.id)} className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium">
                  {t('Yes, paid')}
                </button>
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                >
                  {expandedId === item.id ? t('Hide details') : t('View details')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
