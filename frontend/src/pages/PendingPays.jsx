import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'
import {
  listPendingP2pPays,
  markPendingP2pNotPaid,
  markPendingP2pConfirmed,
  removePendingP2pPay,
  updatePendingP2pPay,
  waitingP2pPays,
} from '../utils/pendingP2pPays.js'
import {
  checkSmsPermission,
  requestSmsPermission,
  scanInboxForPendingPays,
  isSmsPaySupported,
} from '../utils/smsPayWatch.js'
import { handleDetectedUpiPayment } from '../utils/paymentNotify.js'
import client from '../api/client'

function statusLabel(status, t) {
  switch (status) {
    case 'waiting_sms':
    case 'pending':
      return t('Waiting for bank SMS')
    case 'confirmed':
      return t('Paid (SMS verified)')
    case 'not_paid':
      return t('Not paid')
    case 'expired':
      return t('Expired')
    default:
      return status
  }
}

function statusClass(status) {
  switch (status) {
    case 'waiting_sms':
    case 'pending':
      return 'text-amber-500 bg-amber-500/10'
    case 'confirmed':
      return 'text-teal bg-teal/10'
    case 'not_paid':
      return 'text-pink bg-pink/10'
    case 'expired':
      return 'text-slate-500 bg-slate-500/10'
    default:
      return 'text-slate-500'
  }
}

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return new Date(ts).toLocaleString()
}

export default function PendingPays() {
  const { t } = useLanguage()
  const [items, setItems] = useState(() => listPendingP2pPays())
  const [smsOk, setSmsOk] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [hint, setHint] = useState('')

  const refresh = useCallback(() => {
    setItems(listPendingP2pPays())
  }, [])

  useEffect(() => {
    refresh()
    if (!isSmsPaySupported()) return undefined
    checkSmsPermission().then((p) => setSmsOk(!!p?.granted))
    // Always scan on open — catches late SMS without waiting for interval
    scanInboxForPendingPays().then((found) => {
      refresh()
      if (found?.length) {
        setHint(t('Matched') + ` ${found.length} ` + t('payment(s) from SMS.'))
      }
    })
    const onChange = () => refresh()
    window.addEventListener('mm-pending-p2p-changed', onChange)
    window.addEventListener('mm-p2p-sms-confirmed', onChange)
    return () => {
      window.removeEventListener('mm-pending-p2p-changed', onChange)
      window.removeEventListener('mm-p2p-sms-confirmed', onChange)
    }
  }, [refresh, t])

  async function enableSms() {
    const ret = await requestSmsPermission()
    setSmsOk(!!ret?.granted)
    if (ret?.granted) {
      setHint(t('SMS permission on. We will match bank debit SMS automatically (even if late).'))
      await runScan()
    } else {
      setHint(t('SMS permission is required to auto-confirm P2P pays from bank messages.'))
    }
  }

  async function runScan() {
    setScanning(true)
    setHint(t('Checking recent bank SMS…'))
    try {
      const found = await scanInboxForPendingPays()
      refresh()
      if (found.length) {
        setHint(t('Matched') + ` ${found.length} ` + t('payment(s) from SMS.'))
      } else if (waitingP2pPays().length) {
        setHint(t('No matching SMS yet. Bank SMS can take 5–15 minutes — we keep checking.'))
      } else {
        setHint(t('No payments waiting for SMS.'))
      }
    } finally {
      setScanning(false)
    }
  }

  async function markPaidManual(item) {
    setBusyId(item.id)
    try {
      markPendingP2pConfirmed(item.id, { source: 'manual' })
      const [a, c] = await Promise.all([client.get('/accounts'), client.get('/categories')])
      const logResult = await handleDetectedUpiPayment(
        { amount: item.amount, pa: item.pa, payeeName: item.pn, source: 'manual' },
        { accounts: a.data, categories: c.data },
      )
      updatePendingP2pPay(item.id, {
        transactionLogged: !!logResult?.logged,
        transactionId: logResult?.transactionId || null,
        logError: logResult?.logged ? null : (logResult?.needsAccount ? 'needs_account' : null),
      })
      window.dispatchEvent(new CustomEvent('mm-p2p-sms-confirmed', {
        detail: { pending: item, logResult },
      }))
      if (logResult?.logged) {
        setHint(t('Saved in Transactions') + (logResult.categoryName ? ` (${logResult.categoryName})` : ''))
      } else {
        setHint(t('Marked paid — finish category / account to save in Transactions'))
      }
      refresh()
    } catch (err) {
      updatePendingP2pPay(item.id, { transactionLogged: false, logError: err?.message || 'log_failed' })
      setHint(err?.message || t('Could not save transaction'))
      refresh()
    } finally {
      setBusyId(null)
    }
  }

  function markNotPaid(item) {
    markPendingP2pNotPaid(item.id)
    refresh()
  }

  function removeItem(item) {
    removePendingP2pPay(item.id)
    refresh()
  }

  const waiting = items.filter((x) => x.status === 'waiting_sms' || x.status === 'pending')
  const done = items.filter((x) => x.status !== 'waiting_sms' && x.status !== 'pending')

  return (
    <div className="page-stack">
      <h1 className="page-title">{t('Pending pays')}</h1>
      <p className="page-sub">
        {t('P2P (and merchant) pays wait here until bank SMS confirms. When matched, we mark Paid and save the expense in Transactions automatically.')}
      </p>

      {hint && (
        <div className="text-sm text-emerald-700 bg-emerald-50 p-2 rounded-xl mb-1">{hint}</div>
      )}

      {isSmsPaySupported() && (
        <div className="app-card flex flex-wrap items-center gap-2 justify-between">
          <div>
            <div className="text-sm font-semibold">{t('Bank SMS')}</div>
            <div className={`text-xs mt-0.5 ${smsOk ? 'text-teal' : 'text-amber-500'}`}>
              {smsOk ? t('Permission on — auto-check active') : t('Permission off — tap Enable')}
            </div>
          </div>
          <div className="flex gap-2">
            {!smsOk && (
              <button type="button" onClick={enableSms} className="bg-brand-600 text-white rounded-md px-3 py-2 text-sm font-semibold">
                {t('Enable SMS')}
              </button>
            )}
            <button
              type="button"
              disabled={scanning || !smsOk}
              onClick={runScan}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {scanning ? t('Checking…') : t('Check SMS now')}
            </button>
          </div>
        </div>
      )}

      {!isSmsPaySupported() && (
        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl">
          {t('SMS confirmation works in the Android app.')}
        </div>
      )}

      <section>
        <h2 className="font-semibold mb-2 text-sm text-slate-500 uppercase tracking-wide">
          {t('Waiting')} ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <div className="app-card text-sm text-slate-500">{t('No P2P pays waiting for bank SMS.')}</div>
        ) : (
          <div className="space-y-2">
            {waiting.map((item) => (
              <div key={item.id} className="app-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{item.pn || item.pa || t('UPI pay')}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">{item.pa}</div>
                    <div className="text-lg font-bold mt-1">{money(item.amount)}</div>
                    <div className="text-xs text-slate-500 mt-1">{ago(item.createdAt)} · {t('SMS can arrive late')}</div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusClass(item.status)}`}>
                    {statusLabel(item.status, t)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => markPaidManual(item)}
                    className="flex-1 min-w-[7rem] bg-brand-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {t('I paid (manual)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => markNotPaid(item)}
                    className="flex-1 min-w-[7rem] border border-slate-300 rounded-md py-2 text-sm"
                  >
                    {t('Not paid')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 text-sm text-slate-500 uppercase tracking-wide">
            {t('Recent')} ({done.length})
          </h2>
          <div className="space-y-2">
            {done.slice(0, 20).map((item) => (
              <div key={item.id} className="app-card flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.pn || item.pa}</div>
                  <div className="text-sm">{money(item.amount)} · {ago(item.updatedAt || item.createdAt)}</div>
                  {item.status === 'confirmed' && item.transactionLogged && (
                    <div className="text-[10px] text-teal mt-0.5">
                      {t('Saved in Transactions')}
                      {item.source === 'sms' ? ` · ${t('SMS verified')}` : ''}
                    </div>
                  )}
                  {item.status === 'confirmed' && !item.transactionLogged && (
                    <div className="text-[10px] text-amber-500 mt-0.5">
                      {t('Paid — not in Transactions yet (check account / category)')}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusClass(item.status)}`}>
                    {statusLabel(item.status, t)}
                  </span>
                  {item.transactionLogged && (
                    <Link to="/transactions" className="text-xs text-brand-400 font-medium">
                      {t('View')} →
                    </Link>
                  )}
                  <button type="button" onClick={() => removeItem(item)} className="text-xs text-slate-500">
                    {t('Remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
