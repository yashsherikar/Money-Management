import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import {
  peekNextSmsMoneyReview,
  askLaterSmsMoneyReview,
  markSmsMoneyReviewSaved,
  markSmsMoneyReviewScam,
  countPendingSmsMoneyReviews,
  listActiveSmsMoneyReviews,
} from '../utils/smsMoneyReview.js'
import { detectMerchantBrand, MerchantLogo } from '../utils/subscriptionBrands.jsx'

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Forgot-to-add expense (or confirm credit): Ask later / Add / Mark scam.
 * Add stays disabled until category + description are filled.
 */
export default function SmsMoneyReviewPrompt() {
  const { t } = useLanguage()
  const [item, setItem] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [direction, setDirection] = useState('DEBIT')
  const [accountId, setAccountId] = useState('')
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
    setDirection(next.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT')
    setAccountId(next.suggestedAccountId ? String(next.suggestedAccountId) : '')
    setCategoryId(next.suggestedCategoryId ? String(next.suggestedCategoryId) : '')
    setDescription(next.suggestedDescription || next.merchant || '')
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

  const brand = item
    ? detectMerchantBrand(description, item.merchant, item.raw, item.info)
    : null

  const canAdd = !!(
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
      const type = direction === 'CREDIT' ? 'INCOME' : 'EXPENSE'
      const who = brand?.name || item.merchant || (direction === 'CREDIT' ? 'Credit' : 'Expense')
      const desc = [
        String(description).trim(),
        who && !String(description).toLowerCase().includes(String(who).toLowerCase()) ? who : null,
        item.info,
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

  function askLater() {
    if (!item) return
    askLaterSmsMoneyReview(item.id)
    setItem(null)
    const next = peekNextSmsMoneyReview()
    if (next) showNext()
  }

  function markScam() {
    if (!item) return
    if (!confirm(t('Mark this SMS as scam/spam? Messages from this sender will be ignored next time.'))) return
    markSmsMoneyReviewScam(item.id)
    showNext()
  }

  if (!item) return null

  const isExpense = direction === 'DEBIT'
  const catList = isExpense
    ? categories.filter((c) => String(c.name).toLowerCase() !== 'salary')
    : categories

  return (
    <div className="fixed inset-0 z-[66] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl m-0 sm:m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            {brand && <MerchantLogo brand={brand} size={36} />}
            <h2 className="font-bold text-lg leading-tight">
              {isExpense
                ? t('You forgot to add this expense')
                : t('Confirm bank SMS credit')}
            </h2>
          </div>
          {pendingCount > 1 && (
            <span className="text-xs font-semibold text-slate-500 shrink-0">
              1 / {pendingCount}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600 mb-3">
          {isExpense
            ? t('Add where you paid (category + description). Until then Add stays disabled.')
            : t('We found this in SMS but it was not saved yet. Confirm and add details.')}
        </p>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-4">
          <div className="text-2xl font-bold tabular-nums">{money(item.amount)}</div>
          <div className="text-xs text-slate-500 mt-1 space-y-0.5">
            {item.info && <div>{item.info}</div>}
            {item.merchant && <div>{t('To/From')}: {item.merchant}</div>}
            {item.bankLabel && <div>{t('Bank')}: {item.bankLabel}</div>}
            {item.date && <div>{new Date(item.date).toLocaleString()}</div>}
          </div>
          {item.raw && (
            <p className="text-[11px] text-slate-500 mt-2 leading-snug line-clamp-3">{item.raw}</p>
          )}
        </div>

        <div className="mb-3">
          <div className="text-[13px] font-bold text-muted mb-1.5">{t('This was')}</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('DEBIT')}
              className={`rounded-lg py-2.5 text-sm font-semibold border ${
                direction === 'DEBIT'
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              {t('Debit (expense)')}
            </button>
            <button
              type="button"
              onClick={() => setDirection('CREDIT')}
              className={`rounded-lg py-2.5 text-sm font-semibold border ${
                direction === 'CREDIT'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              {t('Credit (income)')}
            </button>
          </div>
        </div>

        <label className="block text-[13px] font-bold text-muted mb-1">{t('Account')}</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full mb-3"
        >
          <option value="">{t('Account...')}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

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
          {brand && (
            <span className="ml-2 inline-flex items-center gap-1 font-medium text-slate-500 normal-case">
              <MerchantLogo brand={brand} size={18} /> {brand.name}
            </span>
          )}
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full mb-4"
          placeholder={t('e.g. Uber to office, Zomato dinner')}
        />

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!canAdd}
            onClick={save}
            className={`w-full rounded-md py-2.5 font-medium ${
              canAdd
                ? 'bg-brand-600 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {busy ? t('Saving…') : t('Add this')}
          </button>
          <button
            type="button"
            onClick={askLater}
            className="w-full border border-slate-300 rounded-md py-2.5 font-medium"
          >
            {t('Ask me later')}
          </button>
          <button
            type="button"
            onClick={markScam}
            className="w-full text-sm text-red-600 py-2 font-medium"
          >
            {t('Mark scam')}
          </button>
        </div>
        {!canAdd && (
          <p className="text-[11px] text-slate-500 mt-2 text-center">
            {t('Pick category and description to enable Add this.')}
          </p>
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
