import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import {
  peekNextSmsMoneyReview,
  markSmsMoneyReviewSaved,
  markSmsMoneyReviewScam,
  dismissSmsMoneyReview,
  countPendingSmsMoneyReviews,
  listActiveSmsMoneyReviews,
} from '../utils/smsMoneyReview.js'
import { confirmSelfTransferFromReview } from '../utils/selfTransferDetect.js'
import { detectMerchantBrand, MerchantLogo } from '../utils/subscriptionBrands.jsx'

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatWhen(ts) {
  const d = new Date(ts || Date.now())
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  }
}

/**
 * Forgot-to-add SMS: show amount / date / time / merchant,
 * category + description, then Add or Scam (block that sender).
 */
export default function SmsMoneyReviewPrompt() {
  const { t } = useLanguage()
  const [item, setItem] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingCount, setPendingCount] = useState(0)

  function showNext() {
    const next = peekNextSmsMoneyReview()
    setPendingCount(countPendingSmsMoneyReviews())
    if (!next) {
      setItem(null)
      return
    }
    setItem(next)
    setAccountId(next.suggestedAccountId ? String(next.suggestedAccountId) : '')
    setToAccountId(next.suggestedToAccountId ? String(next.suggestedToAccountId) : '')
    setCategoryId(next.suggestedCategoryId ? String(next.suggestedCategoryId) : '')
    const liveBrand = detectMerchantBrand(next.merchant, next.raw)
    let desc = next.suggestedDescription || next.merchant || ''
    if (/^cred$/i.test(String(desc).trim()) && !liveBrand) {
      desc = next.merchant || ''
    }
    setDescription(desc)
    setError('')
  }

  useEffect(() => {
    Promise.all([client.get('/accounts'), client.get('/categories')])
      .then(([a, c]) => {
        setAccounts(a.data || [])
        setCategories(c.data || [])
        const primary = (a.data || []).find((x) => x.isPrimary) || (a.data || [])[0]
        setAccountId((id) => id || (primary ? String(primary.id) : ''))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('token')) return undefined
    showNext()
    const onChange = () => showNext()
    window.addEventListener('mm-sms-money-review-changed', onChange)
    window.addEventListener('focus', onChange)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onChange()
    })
    return () => {
      window.removeEventListener('mm-sms-money-review-changed', onChange)
      window.removeEventListener('focus', onChange)
    }
  }, [])

  useEffect(() => {
    if (!item || accountId || !accounts.length) return
    const primary = accounts.find((a) => a.isPrimary) || accounts[0]
    if (primary) setAccountId(String(primary.id))
  }, [item, accounts, accountId])

  useEffect(() => {
    if (!item || toAccountId || !accounts.length || !accountId) return
    const isSt = item.kind === 'self_transfer' || item.reason === 'needs_destination'
    if (!isSt) return
    const other = accounts.find((a) => String(a.id) !== String(accountId))
    if (other && accounts.filter((a) => String(a.id) !== String(accountId)).length === 1) {
      setToAccountId(String(other.id))
    }
  }, [item, accounts, accountId, toAccountId])

  const brand = item
    ? detectMerchantBrand(description, item.merchant, item.raw)
    : null

  const isCredit = item?.direction === 'CREDIT'
  const isSelfTransfer = item?.kind === 'self_transfer'
    || item?.reason === 'needs_destination'

  const canAdd = isSelfTransfer
    ? !!(accountId && toAccountId && accountId !== toAccountId && !busy)
    : !!(
      accountId
      && categoryId
      && String(description || '').trim().length >= 2
      && !busy
    )

  async function save() {
    if (!item || !canAdd) return
    setBusy(true)
    setError('')
    try {
      if (isSelfTransfer) {
        // DEBIT SMS: accountId = source, toAccountId = destination
        // CREDIT SMS: accountId = destination (credited bank), toAccountId = source
        const posted = await confirmSelfTransferFromReview(item, {
          fromAccountId: item.direction === 'DEBIT' ? accountId : toAccountId,
          toAccountId: item.direction === 'DEBIT' ? toAccountId : accountId,
          accounts,
          categories,
        })
        markSmsMoneyReviewSaved(item.id, posted?.debitTxnId || posted?.creditTxnId)
        window.dispatchEvent(new Event('mm-transactions-changed'))
        showNext()
        return
      }

      const type = isCredit ? 'INCOME' : 'EXPENSE'
      const who = item.merchant || (brand && brand.id !== 'cred' ? brand.name : '') || ''
      const desc = [
        String(description).trim(),
        who && !String(description).toLowerCase().includes(String(who).toLowerCase()) ? who : null,
      ].filter(Boolean).join(' · ').slice(0, 220)

      const { data } = await client.post('/transactions', {
        accountId: Number(accountId),
        categoryId: Number(categoryId),
        type,
        amount: Number(item.amount),
        description: desc,
        txnDate: new Date(item.date || Date.now()).toISOString().slice(0, 10),
      })
      markSmsMoneyReviewSaved(item.id, data?.id)
      window.dispatchEvent(new Event('mm-transactions-changed'))
      showNext()
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('Save failed'))
    } finally {
      setBusy(false)
    }
  }

  function markScam() {
    if (!item || busy) return
    markSmsMoneyReviewScam(item.id)
    showNext()
  }

  function notTransfer() {
    if (!item || busy) return
    // Dismiss self-transfer prompt; user can add as normal expense later if needed
    dismissSmsMoneyReview(item.id)
    showNext()
  }

  if (!item) return null

  const { date: whenDate, time: whenTime } = formatWhen(item.date)
  const merchantName = brand?.name || item.merchant || t('Unknown merchant')
  const catList = isCredit
    ? categories
    : categories.filter((c) => String(c.name).toLowerCase() !== 'salary')

  const isCashback = item.kind === 'cashback'
    || /\bcashback|cash\s*back|one97/i.test(String(item.raw || item.info || ''))
  const headline = isSelfTransfer
    ? t('Moved to your other bank?')
    : isCashback
      ? t('Cashback received')
      : isCredit
        ? t('You were credited')
        : t('You were debited')

  const otherAccounts = accounts.filter((a) => String(a.id) !== String(accountId))

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4 pb-20">
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative bg-white w-full max-w-md rounded-2xl p-5 shadow-xl max-h-[min(88vh,100%)] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {brand && !isSelfTransfer && <MerchantLogo brand={brand} size={36} />}
            <h2 className="font-bold text-lg leading-tight">{headline}</h2>
          </div>
          {pendingCount > 1 && (
            <span className="text-xs font-semibold text-slate-500 shrink-0">
              1 / {pendingCount}
            </span>
          )}
        </div>

        <div className={`rounded-xl border p-3 mb-4 ${
          isSelfTransfer
            ? 'bg-sky-50 border-sky-200'
            : isCredit ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}
        >
          <div className={`text-2xl font-bold tabular-nums ${
            isSelfTransfer
              ? 'text-sky-900'
              : isCredit ? 'text-emerald-800' : 'text-red-800'
          }`}
          >
            {money(item.amount)}
          </div>
          <div className="text-sm text-slate-700 mt-2 space-y-1">
            {whenDate && (
              <div>
                <span className="text-slate-500">{t('Date')}: </span>
                {whenDate}
              </div>
            )}
            {whenTime && (
              <div>
                <span className="text-slate-500">{t('Time')}: </span>
                {whenTime}
              </div>
            )}
            {!isSelfTransfer && (
              <div>
                <span className="text-slate-500">{t('Merchant')}: </span>
                <span className="font-semibold">{merchantName}</span>
              </div>
            )}
            {item.bankLabel && (
              <div>
                <span className="text-slate-500">{t('Bank')}: </span>
                {item.bankLabel}
              </div>
            )}
          </div>
        </div>

        {isSelfTransfer ? (
          <>
            <p className="text-sm text-slate-600 mb-3">
              {t('This looks like money moved between your own accounts. Pick from and to — it will save as Transfer (not spend/earn).')}
            </p>

            <label className="block text-[13px] font-bold text-muted mb-1">
              {item.direction === 'DEBIT' ? t('From account') : t('To account (credited)')}
              {' '}
              <span className="text-red-500">*</span>
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full mb-3"
            >
              <option value="">{t('Select account…')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <label className="block text-[13px] font-bold text-muted mb-1">
              {item.direction === 'DEBIT' ? t('To account') : t('From account (source)')}
              {' '}
              <span className="text-red-500">*</span>
            </label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full mb-4"
            >
              <option value="">{t('Select account…')}</option>
              {otherAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canAdd}
                onClick={save}
                className={`rounded-md py-3 font-semibold ${
                  canAdd
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {busy ? t('Saving…') : t('Save transfer')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={notTransfer}
                className="rounded-md py-3 font-semibold border border-slate-300 text-slate-700 bg-slate-50"
              >
                {t('Not a transfer')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-3">
              {isCredit
                ? t('Add category and description to save this credit, or mark Scam to ignore this sender.')
                : t('You forgot to add this. Pick category and description, or mark Scam to block this sender.')}
            </p>

            <label className="block text-[13px] font-bold text-muted mb-1">
              {t('Category')} <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full mb-3"
            >
              <option value="">{t('Select category…')}</option>
              {catList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <label className="block text-[13px] font-bold text-muted mb-1">
              {t('Description')} <span className="text-red-500">*</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mb-4"
              placeholder={t('e.g. Uber to office, Zomato dinner')}
            />

            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canAdd}
                onClick={save}
                className={`rounded-md py-3 font-semibold ${
                  canAdd
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {busy ? t('Saving…') : t('Add')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={markScam}
                className="rounded-md py-3 font-semibold border border-red-300 text-red-700 bg-red-50"
              >
                {t('Scam')}
              </button>
            </div>
            {!canAdd && (
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                {t('Pick category and description to enable Add.')}
              </p>
            )}
          </>
        )}
        {listActiveSmsMoneyReviews().length > 1 && (
          <p className="text-[11px] text-slate-500 mt-1 text-center">
            {t('More SMS waiting after this one.')}
          </p>
        )}
      </div>
    </div>
  )
}
