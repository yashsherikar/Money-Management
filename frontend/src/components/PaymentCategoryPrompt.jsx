import { useEffect, useState } from 'react'
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
  isPaymentNotifySupported,
} from '../utils/paymentNotify.js'

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    if (a.name === 'Other') return 1
    if (b.name === 'Other') return -1
    return a.name.localeCompare(b.name)
  })
}

/**
 * After GPay/PhonePe notifies a payment:
 * - known payee → auto-log with remembered category
 * - new payee → ask category once and remember
 */
export default function PaymentCategoryPrompt() {
  const { t } = useLanguage()
  const [prompt, setPrompt] = useState(null)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    Promise.all([client.get('/accounts'), client.get('/categories')])
      .then(([a, c]) => {
        setAccounts(a.data)
        setCategories(c.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const pending = readPendingCategoryPrompt()
    if (pending) setPrompt(pending)
  }, [])

  useEffect(() => {
    if (!isPaymentNotifySupported() || !accounts.length) return undefined
    return listenForUpiPaymentNotifications(async (parsed) => {
      const result = await handleDetectedUpiPayment(parsed, { accounts, categories })
      if (result.logged) {
        setToast(t('Expense logged.') + (result.categoryName ? ` (${result.categoryName})` : ''))
        setTimeout(() => setToast(''), 4000)
      } else if (result.needsCategory) {
        setPrompt(readPendingCategoryPrompt())
      }
    })
  }, [accounts, categories, t])

  async function saveCategory() {
    if (!prompt || !categoryId || busy) return
    setBusy(true)
    try {
      const cat = categories.find((c) => String(c.id) === String(categoryId))
      const accountId = prompt.accountId || accounts.find((a) => a.isPrimary)?.id || accounts[0]?.id
      if (!accountId) throw new Error(t('Pick an account'))
      await client.post('/transactions', {
        accountId: Number(accountId),
        categoryId: Number(categoryId),
        type: 'EXPENSE',
        amount: Number(prompt.amount),
        description: prompt.pn || prompt.pa || 'UPI payment',
        txnDate: new Date().toISOString().slice(0, 10),
      })
      if (prompt.pa) {
        rememberPayeeCategory(prompt.pa, categoryId, cat?.name)
      }
      clearPendingCategoryPrompt()
      setPrompt(null)
      setCategoryId('')
      window.dispatchEvent(new Event('mm-transactions-changed'))
      setToast(t('Expense logged.'))
      setTimeout(() => setToast(''), 3000)
    } catch (err) {
      setToast(err.response?.data?.message || err.message || t('Save failed'))
    } finally {
      setBusy(false)
    }
  }

  function skip() {
    clearPendingCategoryPrompt()
    setPrompt(null)
  }

  const expenseCategories = sortCategories(categories.filter((c) => c.name !== 'Salary'))

  return (
    <>
      {toast && (
        <div className="fixed top-16 inset-x-0 z-[70] flex justify-center px-4 pointer-events-none">
          <div className="bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>
        </div>
      )}
      {prompt && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={skip} />
          <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl m-0 sm:m-4">
            <h2 className="font-bold text-lg mb-1">{t('Choose a category')}</h2>
            <p className="text-sm text-slate-600 mb-3">
              {t('New payee')}{prompt.pn || prompt.pa ? `: ${prompt.pn || prompt.pa}` : ''}.{' '}
              {t('We will remember this category for next time.')}
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
                {t('Skip')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
