import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'
import client from '../api/client'
import Field from './Field.jsx'
import { brandFromTxnText } from '../utils/subscriptionBrands.jsx'
import MerchantIcon from './MerchantIcon.jsx'
import { useBodyScrollLock } from '../utils/useBodyScrollLock.js'
import ModalPortal from '../utils/ModalPortal.jsx'
import CategoryPicker from './CategoryPicker.jsx'
import { formatTxnDisplay, effectiveMerchantName } from '../utils/txnDisplay.js'

/** Income picker — "Other" is a real category, not "add new". */
const INCOME_SOURCES = ['Salary', 'Freelance', 'Share Market', 'Cashback', 'Refund', 'Interest', 'Other']

const EXPENSE_DEFAULTS = [
  'Dining Out', 'Groceries', 'Rent', 'Transport', 'Shopping', 'Entertainment',
  'Utilities', 'EMI', 'Insurance', 'Healthcare', 'Education', 'Travel', 'Subscriptions', 'Snacks', 'Drinks',
]

/**
 * Merchant (from SMS/QR) and the user's own note as two fields. Older rows have no
 * merchantName — their cleaned description title becomes the merchant. The note stays
 * empty when it would just repeat the merchant (auto-built "Bank SMS: X · UPI …" text).
 */
function splitMerchantAndNote(txn) {
  const cleanDesc = txn.description ? formatTxnDisplay(txn.description, txn.categoryName).title : ''
  const merchantName = effectiveMerchantName(txn.merchantName, txn.accountName) || cleanDesc
  const note = cleanDesc.toLowerCase() === String(merchantName).toLowerCase() ? '' : cleanDesc
  return { merchantName, description: note }
}

function findCategoryByName(categories, name) {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return null
  return categories.find((c) => String(c.name || '').toLowerCase() === n) || null
}

/**
 * Edit one transaction in a popup (stays on the list context).
 */
export default function TransactionEditSheet({
  open,
  txn,
  accounts = [],
  categories = [],
  onClose,
  onSave,
}) {
  const { t } = useLanguage()
  useBodyScrollLock(!!open && !!txn)
  const [form, setForm] = useState(null)
  const [categoryQuery, setCategoryQuery] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [localCategories, setLocalCategories] = useState(categories)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  // Init form only when opening / switching txn — NOT when categories list refreshes
  // (a categories reload used to wipe the category the user just picked).
  useEffect(() => {
    if (!open || !txn) {
      setForm(null)
      return
    }
    setForm({
      accountId: String(txn.accountId),
      categoryId: txn.categoryId != null && txn.categoryId !== '' ? String(txn.categoryId) : '',
      type: txn.type,
      amount: String(txn.amount),
      ...splitMerchantAndNote(txn),
      txnDate: txn.txnDate,
    })
    setAddingCategory(false)
    setNewCategoryName('')
    setError('')
    setBusy(false)
  }, [open, txn?.id])

  // Remap stale clone category ids → visible default id (same name). Never wipe a user pick.
  useEffect(() => {
    if (!open || !form) return
    if (form.categoryId) {
      const byId = localCategories.find((c) => String(c.id) === String(form.categoryId))
      if (byId) {
        setCategoryQuery(byId.name)
        return
      }
      const byName = findCategoryByName(localCategories, txn?.categoryName)
      if (byName) {
        setForm((f) => (f ? { ...f, categoryId: String(byName.id) } : f))
        setCategoryQuery(byName.name)
      }
      return
    }
    if (txn?.categoryName) {
      const byName = findCategoryByName(localCategories, txn.categoryName)
      if (byName) {
        setForm((f) => (f ? { ...f, categoryId: String(byName.id) } : f))
        setCategoryQuery(byName.name)
      }
    }
  }, [open, localCategories, form?.categoryId, txn?.categoryName])

  if (!open || !form || !txn) return null

  // Merchant first, then the user's description (e.g. merchant blank, note "acko activa insurance").
  const brand = brandFromTxnText(form.merchantName) || brandFromTxnText(
    form.description,
    localCategories.find((c) => String(c.id) === form.categoryId)?.name,
  )

  async function ensureCategory(name) {
    let match = findCategoryByName(localCategories, name)
    if (match) return match
    if (!onSave?.addCategory) return null
    const data = await onSave.addCategory(name, { essential: name !== 'Other' })
    if (!data) return null
    setLocalCategories((prev) => [...prev, data])
    return data
  }

  async function pickIncomeSource(name) {
    if (name === '__new__') {
      setAddingCategory(true)
      setNewCategoryName('')
      return
    }
    if (!name) {
      setForm((f) => ({ ...f, categoryId: '' }))
      return
    }
    try {
      const match = await ensureCategory(name)
      if (!match?.id) {
        setError(t('Could not add category'))
        return
      }
      setForm((f) => ({ ...f, categoryId: String(match.id) }))
    } catch (err) {
      setError(err?.response?.data?.message || t('Could not add category'))
    }
  }

  async function handleAddCategory(e) {
    e?.preventDefault?.()
    if (!newCategoryName.trim() || !onSave?.addCategory) return
    const data = await onSave.addCategory(newCategoryName.trim())
    if (!data) return
    setLocalCategories((prev) => [...prev, data])
    setForm((f) => ({ ...f, categoryId: String(data.id) }))
    setCategoryQuery(data.name)
    setNewCategoryName('')
    setAddingCategory(false)
  }

  function handleCategoryInput(value) {
    setCategoryQuery(value)
    const match = localCategories.find((c) => c.name.toLowerCase() === value.trim().toLowerCase())
    setForm((f) => ({ ...f, categoryId: match ? String(match.id) : '' }))
  }

  /** Category changed on a paid-by-QR shop → update the shared hint so the next person who
   *  scans it gets this category. Only updates UPI IDs already known as shops (personal
   *  UPI IDs are never in the shared table). Background, never blocks the save. */
  function shareShopCategory(categoryId) {
    const upiId = String(txn?.paymentId || '').trim()
    const cat = localCategories.find((c) => String(c.id) === String(categoryId))
    if (!upiId.includes('@') || !cat || String(categoryId) === String(txn?.categoryId ?? '')) return
    client.get('/upi-hints', { params: { upiId } })
      .then(({ data }) => {
        if (data?.personal || data?.categoryName === cat.name) return null
        return client.put('/upi-hints', { upiId, categoryName: cat.name, personal: false, displayName: data?.displayName || null })
      })
      .catch(() => {})
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.accountId || !form.amount || busy) return
    setBusy(true)
    setError('')
    try {
      let categoryId = form.categoryId ? Number(form.categoryId) : null
      // Income + Other selected in UI but categoryId empty → resolve real Other
      if (form.type === 'INCOME' && categoryId == null) {
        const other = await ensureCategory('Other')
        categoryId = other?.id != null ? Number(other.id) : null
      }
      if (form.type === 'INCOME' && categoryId == null) {
        setError(t('Select an income category'))
        setBusy(false)
        return
      }
      await onSave?.update?.({
        id: txn.id,
        accountId: Number(form.accountId),
        categoryId,
        type: form.type,
        amount: Number(form.amount),
        // Description stays filled for older screens that only read description.
        description: form.description.trim() || form.merchantName.trim(),
        merchantName: form.merchantName.trim(),
        txnDate: form.txnDate,
      })
      shareShopCategory(categoryId)
      onClose?.()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || t('Save failed'))
    } finally {
      setBusy(false)
    }
  }

  const incomeSelectValue = (() => {
    const cat = localCategories.find((c) => String(c.id) === String(form.categoryId))
    if (!cat) return ''
    return cat.name
  })()

  return (
    <ModalPortal>
    <div className="app-modal" role="dialog" aria-modal="true">
      <div className="app-modal-backdrop" onClick={() => !busy && onClose?.()} />
      <div className="app-modal-panel">
        <div className="app-modal-body">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <MerchantIcon brand={brand} name={form.merchantName} altName={form.description} size={36} />
          <h2 className="font-bold text-lg min-w-0 break-words">{t('Edit transaction')}</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          {t('Update details for this transaction.')}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3 min-w-0">
          <Field label={t('Account')}>
            <select
              required
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              className="w-full"
            >
              <option value="">{t('Account...')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>

          <Field label={t('Type')}>
            <select
              value={form.type}
              onChange={(e) => {
                setAddingCategory(false)
                setCategoryQuery('')
                const nextType = e.target.value
                const other = nextType === 'INCOME' ? findCategoryByName(localCategories, 'Other') : null
                setForm({
                  ...form,
                  type: nextType,
                  categoryId: other?.id != null ? String(other.id) : '',
                })
              }}
              className="w-full"
            >
              <option value="EXPENSE">{t('Expense')}</option>
              <option value="INCOME">{t('Income')}</option>
            </select>
          </Field>

          <Field label={t('Category')}>
            {addingCategory ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  placeholder={t('New category name')}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory(e))}
                  className="flex-1"
                />
                <button type="button" onClick={handleAddCategory} className="px-3 py-2 rounded-md bg-brand-500 text-white text-sm font-medium">
                  {t('Add')}
                </button>
                <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryName('') }} className="px-3 py-2 rounded-md border border-slate-300 text-sm">
                  {t('Cancel')}
                </button>
              </div>
            ) : form.type === 'INCOME' ? (
              <>
                <select
                  required
                  value={incomeSelectValue}
                  onChange={(e) => pickIncomeSource(e.target.value)}
                  className="w-full"
                >
                  <option value="">{t('Select income category…')}</option>
                  {INCOME_SOURCES.map((name) => (
                    <option key={name} value={name}>{t(name)}</option>
                  ))}
                  {localCategories
                    .filter((c) => !INCOME_SOURCES.includes(c.name))
                    .filter((c) => !EXPENSE_DEFAULTS.includes(c.name))
                    .map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  <option value="__new__">{t('+ New income category')}</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {t('Other = gift, reimbursement, or anything else. Cashback = BHIM/Paytm rewards.')}
                </p>
              </>
            ) : (
              <>
                <CategoryPicker
                  categories={localCategories}
                  value={form.categoryId}
                  onChange={(id, cat) => {
                    setForm((f) => ({ ...f, categoryId: String(id) }))
                    setCategoryQuery(cat?.name || '')
                  }}
                  placeholder={t('Search categories…')}
                />
                <button
                  type="button"
                  onClick={() => setAddingCategory(true)}
                  className="mt-2 text-sm text-brand-500 font-medium"
                >
                  {t('+ New category')}
                </button>
              </>
            )}
          </Field>

          <Field label={t('Amount')}>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full"
            />
          </Field>

          <Field label={t('Merchant')}>
            <div className="flex items-center gap-2">
              <MerchantIcon brand={brand} name={form.merchantName} altName={form.description} size={32} />
              <input
                value={form.merchantName}
                onChange={(e) => setForm({ ...form, merchantName: e.target.value })}
                className="w-full"
                placeholder={t('e.g. Payal Super Market, ACKO')}
              />
            </div>
          </Field>

          <Field label={t('Description')}>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full"
              placeholder={t('e.g. Activa insurance, Idli sambhar')}
            />
          </Field>

          <Field label={t('Date')}>
            <input
              type="date"
              required
              value={form.txnDate}
              onChange={(e) => setForm({ ...form, txnDate: e.target.value })}
              className="w-full"
            />
          </Field>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-brand-600 text-white rounded-md py-2.5 font-medium disabled:opacity-60"
            >
              {busy ? t('Saving…') : t('Update')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="px-4 py-2.5 rounded-md border border-slate-300"
            >
              {t('Cancel')}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}
