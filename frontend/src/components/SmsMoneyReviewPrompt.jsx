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
import CategoryPicker from './CategoryPicker.jsx'
import { confirmDuePaid } from '../utils/confirmDuePaid.js'
import { detectMerchantBrand, MerchantLogo } from '../utils/subscriptionBrands.jsx'
import { useBodyScrollLock } from '../utils/useBodyScrollLock.js'
import ModalPortal from '../utils/ModalPortal.jsx'
import { localDateYmd } from '../utils/localDate.js'

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
  useBodyScrollLock(!!item)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingCount, setPendingCount] = useState(0)
  const [useOtherCategory, setUseOtherCategory] = useState(false)

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
    setUseOtherCategory(!(next.matchedDues && next.matchedDues.length))
    setError('')
  }

  async function confirmMatch(match) {
    if (!item || !match || busy) return
    setBusy(true)
    setError('')
    try {
      await confirmDuePaid(match.relatedType, match.relatedId)
      markSmsMoneyReviewSaved(item.id, null)
      showNext()
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('Save failed'))
    } finally {
      setBusy(false)
    }
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
    const onVis = () => {
      if (document.visibilityState === 'visible') onChange()
    }
    window.addEventListener('mm-sms-money-review-changed', onChange)
    window.addEventListener('focus', onChange)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('mm-sms-money-review-changed', onChange)
      window.removeEventListener('focus', onChange)
      document.removeEventListener('visibilitychange', onVis)
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
        txnDate: localDateYmd(item.date || Date.now()),
      })
      markSmsMoneyReviewSaved(item.id, data?.id)
      if (!isCredit) {
        try {
          const { tryConfirmMatchingDues } = await import('../utils/matchDueSms.js')
          await tryConfirmMatchingDues({
            amount: item.amount,
            merchant: item.merchant || who,
            raw: item.raw || desc,
            allowUniqueAmount: true,
          })
        } catch { /* ignore */ }
      }
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
    <ModalPortal>
    <div className="app-modal" role="dialog" aria-modal="true">
      <div className="app-modal-backdrop" />
      <div className="app-modal-panel">
        <div className="app-modal-body">
        <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {brand && !isSelfTransfer && <MerchantLogo brand={brand} size={36} />}
            <h2 className="font-bold text-lg leading-tight break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>{headline}</h2>
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
            {item.matchedDues?.length > 0 && !useOtherCategory ? (
              <>
                <p className="text-sm text-slate-600 mb-3">
                  {t('This amount matches something in your app. Pick what you paid, or choose Another expense.')}
                </p>
                <div className="space-y-2 mb-3">
                  {item.matchedDues.map((m) => (
                    <button
                      key={`${m.relatedType}-${m.relatedId}`}
                      type="button"
                      disabled={busy}
                      onClick={() => confirmMatch(m)}
                      className="w-full text-left rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-3 hover:bg-brand-500/15 disabled:opacity-60"
                    >
                      <div className="text-xs font-bold uppercase tracking-wide text-brand-soft">
                        {m.kind === 'emi' ? t('EMI')
                          : m.kind === 'emergency_fund' ? t('Emergency fund')
                            : t('Recurring')}
                      </div>
                      <div className="font-semibold text-slate-100 mt-0.5">{m.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{money(m.amount)}</div>
                    </button>
                  ))}
                </div>
                {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setUseOtherCategory(true)}
                  className="w-full rounded-md py-3 font-semibold border border-slate-300 text-slate-700 bg-slate-50 mb-2"
                >
                  {t('Another expense…')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={markScam}
                  className="w-full rounded-md py-2.5 text-sm font-semibold text-red-700"
                >
                  {t('Scam')}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-3">
                  {isCredit
                    ? t('Add category and description to save this credit, or mark Scam to ignore this sender.')
                    : t('You forgot to add this. Pick category and description, or mark Scam to block this sender.')}
                </p>

                {item.matchedDues?.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setUseOtherCategory(false)}
                    className="mb-3 text-xs font-semibold text-brand-400"
                  >
                    ← {t('Back to matches')}
                  </button>
                )}

                <label className="block text-[13px] font-bold text-muted mb-1">
                  {t('Category')} <span className="text-red-500">*</span>
                </label>
                <CategoryPicker
                  categories={catList}
                  value={categoryId}
                  onChange={(id) => setCategoryId(id)}
                  className="mb-3"
                />

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
          </>
        )}
        {listActiveSmsMoneyReviews().length > 1 && (
          <p className="text-[11px] text-slate-500 mt-1 text-center">
            {t('More SMS waiting after this one.')}
          </p>
        )}
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}
