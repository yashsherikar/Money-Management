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
import { handleDetectedUpiPayment, syncUnloggedConfirmedPays } from '../utils/paymentNotify.js'

function statusLabel(status, t, item) {
  switch (status) {
    case 'waiting_sms':
    case 'pending':
      return t('Waiting for bank SMS')
    case 'confirmed':
      if (item?.source === 'sms') return t('Paid · SMS')
      if (item?.source === 'manual') return t('Paid · Manual')
      return t('Paid')
    case 'not_paid':
      return t('Not paid')
    case 'expired':
      return t('Expired')
    default:
      return status
  }
}

function kindLabel(item, t) {
  if (item.personal === false) return t('Merchant')
  return t('P2P')
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
    // Push any Paid-but-missing Transactions into the ledger
    syncUnloggedConfirmedPays()
      .then((r) => {
        refresh()
        const n = (r || []).filter((x) => x.logged).length
        if (n) setHint(t('Saved') + ` ${n} ` + t('paid pay(s) into Transactions.'))
      })
      .catch(() => {})

    if (!isSmsPaySupported()) return undefined
    checkSmsPermission().then((p) => setSmsOk(!!p?.granted))
    scanInboxForPendingPays().then(async () => {
      await syncUnloggedConfirmedPays().catch(() => {})
      refresh()
    })
    const onChange = () => refresh()
    window.addEventListener('mm-pending-p2p-changed', onChange)
    window.addEventListener('mm-p2p-sms-confirmed', onChange)
    window.addEventListener('mm-transactions-changed', onChange)
    return () => {
      window.removeEventListener('mm-pending-p2p-changed', onChange)
      window.removeEventListener('mm-p2p-sms-confirmed', onChange)
      window.removeEventListener('mm-transactions-changed', onChange)
    }
  }, [refresh, t])

  async function enableSms() {
    const ret = await requestSmsPermission()
    setSmsOk(!!ret?.granted)
    if (ret?.granted) {
      setHint(t('SMS on. Only new debit/credit SMS are used — ads, scam, and old inbox are ignored.'))
      await runScan()
    } else {
      setHint(t('SMS permission is required to auto-confirm P2P pays from bank messages.'))
    }
  }

  async function runScan() {
    setScanning(true)
    setHint(t('Listening for new bank SMS…'))
    try {
      // Live watch only — does not read old inbox history
      await scanInboxForPendingPays()
      refresh()
      if (waitingP2pPays().length) {
        setHint(t('Waiting for a new debit SMS. Ads, scam, and spam are ignored.'))
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
      const logResult = await handleDetectedUpiPayment(
        {
          amount: item.amount,
          pa: item.pa,
          payeeName: item.pn,
          source: 'manual',
          personal: item.personal,
          kind: item.personal === false ? 'merchant' : 'p2p',
          forceLog: true,
        },
      )
      updatePendingP2pPay(item.id, {
        transactionLogged: !!logResult?.logged,
        transactionId: logResult?.transactionId || null,
        logError: logResult?.logged ? null : (logResult?.error || 'log_failed'),
      })
      window.dispatchEvent(new CustomEvent('mm-p2p-sms-confirmed', {
        detail: { pending: item, logResult },
      }))
      if (logResult?.logged) {
        setHint(t('Saved in Transactions') + (logResult.categoryName ? ` (${logResult.categoryName})` : ''))
      } else {
        setHint(t('Marked paid but Transactions save failed') + (logResult?.error ? `: ${logResult.error}` : ''))
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

  async function saveToTransactions(item) {
    setBusyId(item.id)
    try {
      const logResult = await handleDetectedUpiPayment({
        amount: item.amount,
        pa: item.pa,
        payeeName: item.pn,
        source: item.source || 'manual',
        personal: item.personal,
        kind: item.personal === false ? 'merchant' : 'p2p',
        forceLog: true,
      })
      updatePendingP2pPay(item.id, {
        transactionLogged: !!logResult?.logged,
        transactionId: logResult?.transactionId || null,
        logError: logResult?.logged ? null : (logResult?.error || 'log_failed'),
      })
      if (logResult?.logged) {
        setHint(t('Saved in Transactions') + (logResult.categoryName ? ` (${logResult.categoryName})` : ''))
      } else {
        setHint(t('Could not save') + (logResult?.error ? `: ${logResult.error}` : ''))
      }
      refresh()
    } catch (err) {
      setHint(err?.message || t('Could not save transaction'))
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
              {scanning ? t('Listening…') : t('Listen for new SMS')}
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
                    {statusLabel(item.status, t, item)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">{kindLabel(item, t)}</div>
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
            {t('Pay history')} ({done.length})
          </h2>
          <p className="text-xs text-slate-500 mb-2">
            {t('P2P, request pays, and QR/merchant pays marked Paid appear here. Paid ones should also show in Transactions.')}
          </p>
          <div className="space-y-2">
            {done.slice(0, 40).map((item) => (
              <div key={item.id} className="app-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.pn || item.pa}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">{item.pa}</div>
                    <div className="text-sm mt-0.5">
                      {money(item.amount)} · {ago(item.updatedAt || item.createdAt)}
                      {' · '}
                      <span className="uppercase tracking-wide text-[10px]">{kindLabel(item, t)}</span>
                    </div>
                    {item.status === 'confirmed' && item.transactionLogged && (
                      <div className="text-[10px] text-teal mt-0.5">
                        {t('In Transactions')}
                        {item.source === 'sms' ? ` · ${t('SMS')}` : item.source === 'manual' ? ` · ${t('Manual')}` : ''}
                      </div>
                    )}
                    {item.status === 'confirmed' && !item.transactionLogged && (
                      <div className="text-[10px] text-amber-500 mt-0.5">
                        {t('Paid — missing from Transactions')}
                        {item.logError ? ` (${item.logError})` : ''}
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusClass(item.status)}`}>
                    {statusLabel(item.status, t, item)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {item.status === 'confirmed' && !item.transactionLogged && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => saveToTransactions(item)}
                      className="flex-1 min-w-[8rem] bg-brand-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
                    >
                      {busyId === item.id ? t('Saving…') : t('Save to Transactions')}
                    </button>
                  )}
                  {item.transactionLogged && (
                    <Link to="/transactions" className="text-xs text-brand-600 font-medium self-center px-1">
                      {t('View Transactions')} →
                    </Link>
                  )}
                  <button type="button" onClick={() => removeItem(item)} className="text-xs text-slate-500 self-center ml-auto">
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
