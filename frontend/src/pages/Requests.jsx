import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

const statusTone = {
  PENDING: 'text-amber-600',
  ACCEPTED: 'text-brand-600',
  DECLINED: 'text-red-600',
  PAID: 'text-emerald-600',
}

export default function Requests() {
  const { t } = useLanguage()
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])

  async function load() {
    const [inRes, outRes] = await Promise.all([
      client.get('/contribution-requests/incoming'),
      client.get('/contribution-requests/outgoing'),
    ])
    setIncoming(inRes.data)
    setOutgoing(outRes.data)
  }

  useEffect(() => {
    load()
  }, [])

  async function accept(id) { await client.patch(`/contribution-requests/${id}/accept`); load() }
  async function decline(id) { await client.patch(`/contribution-requests/${id}/decline`); load() }
  async function markPaid(id) { await client.patch(`/contribution-requests/${id}/mark-paid`); load() }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Contribution requests')}</h1>

      <h2 className="font-semibold mb-3">{t('Asking you to pay')}</h2>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-8">
        {incoming.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No requests.')}</div>}
        {incoming.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-medium">{r.requesterName} {t('wants')} {money(r.amount)} {t('for')} "{r.wishlistItemName}"</div>
              <div className={`text-xs font-medium ${statusTone[r.status]}`}>{t(r.status)}</div>
            </div>
            <div className="flex items-center gap-2">
              {r.status === 'PENDING' && (
                <>
                  <button onClick={() => accept(r.id)} className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium">{t('Accept')}</button>
                  <button onClick={() => decline(r.id)} className="border border-slate-300 rounded-md px-3 py-1.5 text-sm">{t('Decline')}</button>
                </>
              )}
              {r.status === 'ACCEPTED' && (
                r.upiPayLink ? (
                  <a href={r.upiPayLink} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-3 py-1.5 text-sm font-medium">
                    {t('Pay via UPI')}
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">{r.requesterName} {t("hasn't added a UPI ID yet")}</span>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-semibold mb-3">{t('You asked others to pay')}</h2>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {outgoing.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No requests.')}</div>}
        {outgoing.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-medium">{r.memberName} · {money(r.amount)} {t('for')} "{r.wishlistItemName}"</div>
              <div className={`text-xs font-medium ${statusTone[r.status]}`}>{t(r.status)}</div>
            </div>
            {r.status === 'ACCEPTED' && (
              <button onClick={() => markPaid(r.id)} className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium">
                {t('Mark as received')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
