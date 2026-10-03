import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import { suppressResumeLock, savePendingUpiConfirm } from '../appLock.js'
import { copyVpaAndOpenApp, parseUpiQr, formatUpiAmount } from '../utils/upiQr.js'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

const statusTone = {
  PENDING: 'text-amber-600',
  ACCEPTED: 'text-brand-600',
  DECLINED: 'text-red-600',
  PAID: 'text-emerald-600',
}

const emptyAsk = { email: '', amount: '', note: '' }

export default function Requests() {
  const { t } = useLanguage()
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [payIncoming, setPayIncoming] = useState([])
  const [payOutgoing, setPayOutgoing] = useState([])
  const [ask, setAsk] = useState(emptyAsk)
  const [askError, setAskError] = useState('')
  const [askOk, setAskOk] = useState(false)
  const [asking, setAsking] = useState(false)
  const [payingId, setPayingId] = useState(null)

  async function load() {
    const [inRes, outRes, payInRes, payOutRes] = await Promise.all([
      client.get('/contribution-requests/incoming'),
      client.get('/contribution-requests/outgoing'),
      client.get('/payment-requests/incoming'),
      client.get('/payment-requests/outgoing'),
    ])
    setIncoming(inRes.data)
    setOutgoing(outRes.data)
    setPayIncoming(payInRes.data)
    setPayOutgoing(payOutRes.data)
  }

  useEffect(() => {
    load()
  }, [])

  async function accept(id) { await client.patch(`/contribution-requests/${id}/accept`); load() }
  async function decline(id) { await client.patch(`/contribution-requests/${id}/decline`); load() }
  async function markPaid(id) { await client.patch(`/contribution-requests/${id}/mark-paid`); load() }

  async function acceptPay(id) { await client.patch(`/payment-requests/${id}/accept`); load() }
  async function declinePay(id) { await client.patch(`/payment-requests/${id}/decline`); load() }
  async function markPayReceived(id) { await client.patch(`/payment-requests/${id}/mark-paid`); load() }

  /**
   * P2P money requests: GPay deep-link often fails. Copy UPI ID + open app,
   * then persist "Did you pay?" so it still shows after both apps are closed.
   */
  async function payRequestP2p(r, { kind = 'payment_request' } = {}) {
    if (!r.upiPayLink && !r.requesterUpiId) {
      alert(t("hasn't added a UPI ID yet"))
      return
    }
    setPayingId(r.id)
    try {
      let pa = r.requesterUpiId || ''
      let am = formatUpiAmount(r.amount || r.shareAmount)
      if (!pa && r.upiPayLink) {
        try {
          const parsed = parseUpiQr(r.upiPayLink)
          pa = parsed.pa
          am = formatUpiAmount(parsed.am || r.amount || r.shareAmount) || am
        } catch {
          /* fall through */
        }
      }
      if (!pa || !am) {
        alert(t('Could not open UPI app'))
        return
      }
      suppressResumeLock(300_000)
      savePendingUpiConfirm({
        kind,
        requestId: r.id,
        participantId: r.participantId || null,
        pa,
        am,
        amount: am,
        name: r.requesterName || r.payerName || pa,
        pn: r.requesterName || '',
      })
      await copyVpaAndOpenApp({ pa, amount: am, app: 'gpay' })
    } catch (e) {
      alert(e.message || t('Could not open UPI app'))
    } finally {
      setPayingId(null)
    }
  }

  async function handleAsk(e) {
    e.preventDefault()
    setAskError('')
    setAskOk(false)
    setAsking(true)
    try {
      await client.post('/payment-requests', {
        email: ask.email.trim(),
        amount: Number(ask.amount),
        note: ask.note.trim() || null,
      })
      setAsk(emptyAsk)
      setAskOk(true)
      load()
    } catch (err) {
      setAskError(err.response?.data?.message || t('Could not send request'))
    } finally {
      setAsking(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Requests')}</h1>

      <section className="mb-8 bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="font-semibold mb-1">{t('Ask for money')}</h2>
        <p className="text-sm text-slate-500 mb-4">
          {t('Ask a friend who uses Money Manager. They get a notification and can pay you via UPI.')}
        </p>
        {askError && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{askError}</div>}
        {askOk && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 p-2 rounded">{t('Request sent.')}</div>}
        <form onSubmit={handleAsk} className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("Friend's email")}</label>
            <input
              type="email"
              required
              value={ask.email}
              onChange={(e) => setAsk((f) => ({ ...f, email: e.target.value }))}
              placeholder="friend@email.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Amount')}</label>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={ask.amount}
              onChange={(e) => setAsk((f) => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Reason (optional)')}</label>
            <input
              type="text"
              value={ask.note}
              onChange={(e) => setAsk((f) => ({ ...f, note: e.target.value }))}
              placeholder={t('e.g. lunch, urgent')}
              maxLength={255}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
          <button
            type="submit"
            disabled={asking}
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {asking ? t('Sending…') : t('Send request')}
          </button>
        </form>
      </section>

      <h2 className="font-semibold mb-3">{t('Friends asking you for money')}</h2>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-8">
        {payIncoming.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No requests.')}</div>}
        {payIncoming.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-medium">
                {r.requesterName} {t('wants')} {money(r.amount)}
                {r.note ? <> {t('for')} "{r.note}"</> : null}
              </div>
              <div className={`text-xs font-medium ${statusTone[r.status]}`}>{t(r.status)}</div>
            </div>
            <div className="flex items-center gap-2">
              {r.status === 'PENDING' && (
                <>
                  <button onClick={() => acceptPay(r.id)} className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium">{t('Accept')}</button>
                  <button onClick={() => declinePay(r.id)} className="border border-slate-300 rounded-md px-3 py-1.5 text-sm">{t('Decline')}</button>
                </>
              )}
              {r.status === 'ACCEPTED' && (
                (r.upiPayLink || r.requesterUpiId) ? (
                  <button
                    type="button"
                    disabled={payingId === r.id}
                    onClick={() => payRequestP2p(r)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                  >
                    {payingId === r.id ? t('Opening…') : t('Pay via UPI')}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">{r.requesterName} {t("hasn't added a UPI ID yet")}</span>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-semibold mb-3">{t('Money you asked for')}</h2>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-8">
        {payOutgoing.length === 0 && <div className="p-4 text-sm text-slate-500">{t('No requests.')}</div>}
        {payOutgoing.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-medium">
                {r.payerName} · {money(r.amount)}
                {r.note ? <> {t('for')} "{r.note}"</> : null}
              </div>
              <div className={`text-xs font-medium ${statusTone[r.status]}`}>{t(r.status)}</div>
            </div>
            {(r.status === 'ACCEPTED' || r.status === 'PENDING') && (
              <button onClick={() => markPayReceived(r.id)} className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium">
                {t('Mark as received')}
              </button>
            )}
          </div>
        ))}
      </div>

      <h2 className="font-semibold mb-3">{t('Wishlist — asking you to pay')}</h2>
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
                (r.upiPayLink || r.requesterUpiId) ? (
                  <button
                    type="button"
                    disabled={payingId === r.id}
                    onClick={() => payRequestP2p(r, { kind: 'contribution' })}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                  >
                    {payingId === r.id ? t('Opening…') : t('Pay via UPI')}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">{r.requesterName} {t("hasn't added a UPI ID yet")}</span>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-semibold mb-3">{t('Wishlist — you asked others')}</h2>
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
