import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import {
  readPendingCategoryPrompt,
  clearPendingCategoryPrompt,
  rememberPayeeCategory,
} from '../utils/savedPayees.js'
import {
  listenForUpiPaymentNotifications,
  handleDetectedUpiPayment,
  closePendingAfterUpiLog,
  updateLoggedUpiCategory,
  isPaymentNotifySupported,
} from '../utils/paymentNotify.js'
import { useBodyScrollLock } from '../utils/useBodyScrollLock.js'
import ModalPortal from '../utils/ModalPortal.jsx'

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    if (a.name === 'Other') return 1
    if (b.name === 'Other') return -1
    return a.name.localeCompare(b.name)
  })
}

/**
 * After SMS / notify confirms a payment:
 * - transaction is already logged (or we log now)
 * - known payee → toast only
 * - new payee → ask category to refine (updates the txn)
 */
export default function PaymentCategoryPrompt() {
  const { t } = useLanguage()
  const [prompt, setPrompt] = useState(null)
  useBodyScrollLock(!!prompt)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const accountsRef = useRef([])
  const categoriesRef = useRef([])
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    Promise.all([client.get('/accounts'), client.get('/categories')])
      .then(([a, c]) => {
        setAccounts(a.data)
        setCategories(c.data)
        accountsRef.current = a.data || []
        categoriesRef.current = c.data || []
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    accountsRef.current = accounts
    categoriesRef.current = categories
  }, [accounts, categories])

  useEffect(() => {
    const pending = readPendingCategoryPrompt()
    if (pending) setPrompt(pending)
  }, [])

  useEffect(() => {
    const onSmsConfirmed = (e) => {
      const result = e?.detail?.logResult
      if (result?.logged && !result?.needsCategory) {
        setToast(
          t('Paid — saved in Transactions')
            + (result.categoryName ? ` (${result.categoryName})` : ''),
        )
        setTimeout(() => setToast(''), 4500)
      } else if (result?.logged && result?.needsCategory) {
        setPrompt(readPendingCategoryPrompt())
        setToast(t('Saved in Transactions — pick a better category?'))
        setTimeout(() => setToast(''), 4000)
      } else if (result?.needsCategory || result?.needsAccount) {
        setPrompt(readPendingCategoryPrompt())
        setToast(t('Bank SMS matched — finish logging'))
        setTimeout(() => setToast(''), 4000)
      } else {
        setToast(t('Bank SMS matched — marked Paid'))
        setTimeout(() => setToast(''), 4000)
      }
    }
    window.addEventListener('mm-p2p-sms-confirmed', onSmsConfirmed)
    return () => window.removeEventListener('mm-p2p-sms-confirmed', onSmsConfirmed)
  }, [t])

  useEffect(() => {
    if (!isPaymentNotifySupported()) return undefined
    return listenForUpiPaymentNotifications(async (parsed) => {
      const accs = accountsRef.current
      const cats = categoriesRef.current
      if (!accs.length) return
      const result = await handleDetectedUpiPayment(parsed, { accounts: accs, categories: cats })
      await closePendingAfterUpiLog(parsed, result)
      if (result.logged && !result.needsCategory) {
        setToast(tRef.current('Expense logged.') + (result.categoryName ? ` (${result.categoryName})` : ''))
        setTimeout(() => setToast(''), 4000)
      } else if (result.needsCategory) {
        setPrompt(readPendingCategoryPrompt())
      } else if (result.duplicate) {
        setToast(tRef.current('Expense already logged'))
        setTimeout(() => setToast(''), 3000)
      }
    })
  }, [])

  async function saveCategory() {
    if (!prompt || !categoryId || busy) return
    setBusy(true)
    try {
      const cat = categories.find((c) => String(c.id) === String(categoryId))
      const accountId = prompt.accountId || accounts.find((a) => a.isPrimary)?.id || accounts[0]?.id
      if (!accountId) throw new Error(t('Pick an account'))

      if (prompt.refineOnly && prompt.transactionId) {
        await updateLoggedUpiCategory({
          transactionId: prompt.transactionId,
          accountId,
          amount: prompt.amount,
          description: prompt.description,
          pa: prompt.pa,
          pn: prompt.pn,
          categoryId,
          categories,
          txnDate: prompt.txnDate,
        })
      } else if (prompt.refineOnly && !prompt.transactionId) {
        if (prompt.pa) rememberPayeeCategory(prompt.pa, categoryId, cat?.name)
        window.dispatchEvent(new Event('mm-transactions-changed'))
      } else {
        // Not logged yet — create with chosen category
        if (prompt.pa) rememberPayeeCategory(prompt.pa, categoryId, cat?.name)
        const result = await handleDetectedUpiPayment(
          {
            amount: prompt.amount,
            pa: prompt.pa,
            payeeName: prompt.pn,
            source: prompt.source || 'manual',
            categoryId,
            description: prompt.description || null,
          },
          { accounts, categories },
        )
        await closePendingAfterUpiLog({
          amount: prompt.amount,
          pa: prompt.pa,
          payeeName: prompt.pn,
          source: prompt.source || 'manual',
        }, result)
        // If auto-picked Other somehow, force update to chosen category
        if (result?.transactionId && String(result.categoryName || '').toLowerCase() === 'other'
            && cat && String(cat.name).toLowerCase() !== 'other') {
          await updateLoggedUpiCategory({
            transactionId: result.transactionId,
            accountId,
            amount: prompt.amount,
            description: prompt.description,
            pa: prompt.pa,
            pn: prompt.pn,
            categoryId,
            categories,
            txnDate: prompt.txnDate,
          })
        }
      }

      clearPendingCategoryPrompt()
      setPrompt(null)
      setCategoryId('')
      setToast(t('Saved in Transactions'))
      setTimeout(() => setToast(''), 3000)
    } catch (err) {
      setToast(err.response?.data?.message || err.message || t('Save failed'))
    } finally {
      setBusy(false)
    }
  }

  function skip() {
    // Transaction already logged when refineOnly — skip just closes refine UI
    clearPendingCategoryPrompt()
    setPrompt(null)
  }

  const expenseCategories = sortCategories(categories.filter((c) => c.name !== 'Salary'))

  return (
    <ModalPortal>
      {toast && (
        <div className="fixed top-16 inset-x-0 z-[90] flex justify-center px-4 pointer-events-none">
          <div className="bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>
        </div>
      )}
      {prompt && (
        <div className="app-modal" role="dialog" aria-modal="true">
          <div className="app-modal-backdrop" onClick={skip} />
          <div className="app-modal-panel">
            <div className="app-modal-body">
            <h2 className="font-bold text-lg mb-1">
              {prompt.refineOnly ? t('Update category') : t('Choose a category')}
            </h2>
            <p className="text-sm text-slate-600 mb-3 break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>
              {prompt.refineOnly
                ? t('Already saved in Transactions as Other. Pick the right category for next time.')
                : (
                  <>
                    {t('New payee')}{prompt.pn || prompt.pa ? `: ${prompt.pn || prompt.pa}` : ''}.{' '}
                    {t('We will remember this category for next time.')}
                  </>
                )}
            </p>
            <div className="text-sm font-medium mb-3">
              ₹{Number(prompt.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md mb-4"
            >
              <option value="">{t('Select…')}</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !categoryId}
                onClick={saveCategory}
                className="flex-1 bg-brand-600 text-white rounded-md py-2.5 font-medium disabled:opacity-60"
              >
                {busy ? t('Saving…') : t('Save')}
              </button>
              <button type="button" onClick={skip} className="flex-1 border border-slate-300 rounded-md py-2.5">
                {prompt.refineOnly ? t('Keep Other') : t('Skip')}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </ModalPortal>
  )
}
