import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { EditIcon, DeleteIcon } from '../components/icons.jsx'
import Field from '../components/Field.jsx'
import CollapsibleSection from '../components/CollapsibleSection.jsx'
import MoneyRow, { MoneyList, RowAction } from '../components/MoneyRow.jsx'
import TransactionEditSheet from '../components/TransactionEditSheet.jsx'
import TransactionDetailSheet from '../components/TransactionDetailSheet.jsx'
import CategoryPicker from '../components/CategoryPicker.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { waitingP2pPays, countWaitingP2pPays, listPendingP2pPays } from '../utils/pendingP2pPays.js'
import { syncUnloggedConfirmedPays } from '../utils/paymentNotify.js'
import { brandFromTxnText, MerchantLogo } from '../utils/subscriptionBrands.jsx'
import { buildTxnRowDisplay } from '../utils/txnDisplay.js'
import { localDateYmd } from '../utils/localDate.js'
import {
  groupTransactionsByDate,
  formatTxnDayLabel,
  formatTxnTime,
} from '../utils/txnSort.js'

const emptyForm = { accountId: '', categoryId: '', type: 'EXPENSE', amount: '', description: '', txnDate: localDateYmd() }
/** Income picker options — "Other" is a real category, not "add new". */
const INCOME_SOURCES = ['Salary', 'Freelance', 'Share Market', 'Cashback', 'Refund', 'Interest', 'Other']

function findCategoryByName(categories, name) {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return null
  return categories.find((c) => String(c.name || '').toLowerCase() === n) || null
}

export default function Transactions() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingTxn, setEditingTxn] = useState(null)
  const [viewingTxn, setViewingTxn] = useState(null)
  const [error, setError] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryQuery, setCategoryQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [waitingPays, setWaitingPays] = useState(() => waitingP2pPays())
  const [unloggedPays, setUnloggedPays] = useState([])

  async function loadAll() {
    const [txnRes, accRes, catRes] = await Promise.all([
      client.get('/transactions'),
      client.get('/accounts'),
      client.get('/categories'),
    ])
    setTransactions(Array.isArray(txnRes.data) ? txnRes.data : [])
    setAccounts(accRes.data)
    setCategories(catRes.data)
    setWaitingPays(waitingP2pPays())
    setUnloggedPays(
      listPendingP2pPays().filter((p) => p.status === 'confirmed' && !p.transactionLogged),
    )
    const primary = accRes.data.find((a) => a.isPrimary) || accRes.data[0]
    if (primary) setForm((f) => (f.accountId ? f : { ...f, accountId: String(primary.id) }))
  }

  useEffect(() => {
    loadAll()
    syncUnloggedConfirmedPays()
      .then(() => loadAll())
      .catch(() => {})
    const onRefresh = () => loadAll()
    window.addEventListener('mm-transactions-changed', onRefresh)
    window.addEventListener('mm-pending-p2p-changed', onRefresh)
    window.addEventListener('mm-p2p-sms-confirmed', onRefresh)
    return () => {
      window.removeEventListener('mm-transactions-changed', onRefresh)
      window.removeEventListener('mm-pending-p2p-changed', onRefresh)
      window.removeEventListener('mm-p2p-sms-confirmed', onRefresh)
    }
  }, [])

  const txnGroups = useMemo(() => groupTransactionsByDate(transactions), [transactions])

  function resetForm() {
    setForm(emptyForm)
    setFormOpen(false)
    setCategoryQuery('')
    setAddingCategory(false)
  }

  async function ensureIncomeCategoryId(rawId) {
    if (rawId) return Number(rawId)
    // UI may show Other while categoryId was never set — resolve real Other
    const other = findCategoryByName(categories, 'Other')
    if (other?.id != null) return Number(other.id)
    try {
      const { data } = await client.post('/categories', { name: 'Other', essential: false })
      setCategories((prev) => [...prev, data])
      return Number(data.id)
    } catch {
      return null
    }
  }

  async function pickIncomeSource(name) {
    if (name === '__new__') {
      setAddingCategory(true)
      setNewCategoryName('')
      return
    }
    let match = findCategoryByName(categories, name)
    if (!match) {
      try {
        const { data } = await client.post('/categories', {
          name,
          essential: name !== 'Other',
        })
        match = data
        setCategories((prev) => [...prev, data])
      } catch (err) {
        setError(err.response?.data?.message || t('Could not add category'))
        return
      }
    }
    setForm((f) => ({ ...f, categoryId: String(match.id) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      let categoryId = form.categoryId ? Number(form.categoryId) : null
      if (form.type === 'INCOME' && categoryId == null) {
        categoryId = await ensureIncomeCategoryId(form.categoryId)
      }
      if (form.type === 'INCOME' && categoryId == null) {
        setError(t('Select an income category'))
        return
      }
      const payload = {
        accountId: Number(form.accountId),
        categoryId,
        type: form.type,
        amount: Number(form.amount),
        description: form.description,
        txnDate: form.txnDate,
      }
      await client.post('/transactions', payload)
      resetForm()
      loadAll()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  function startEdit(txn) {
    setFormOpen(false)
    setViewingTxn(null)
    setEditingTxn(txn)
  }

  function openTxnDetail(txn) {
    setFormOpen(false)
    setEditingTxn(null)
    setViewingTxn(txn)
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this transaction? Account balance and dashboard will be updated.'))) return
    await client.delete(`/transactions/${id}`)
    window.dispatchEvent(new CustomEvent('mm-transactions-changed'))
    await loadAll()
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    const { data } = await client.post('/categories', { name: newCategoryName.trim(), essential: false })
    setCategories((prev) => [...prev, data])
    setForm((f) => ({ ...f, categoryId: String(data.id) }))
    setCategoryQuery(data.name)
    setNewCategoryName('')
    setAddingCategory(false)
  }

  function handleCategoryInput(value) {
    setCategoryQuery(value)
    const match = categories.find((c) => c.name.toLowerCase() === value.trim().toLowerCase())
    setForm((f) => ({ ...f, categoryId: match ? String(match.id) : '' }))
  }

  function handleCategoryBlur() {
    const typed = categoryQuery.trim()
    if (!typed) return
    const match = categories.find((c) => c.name.toLowerCase() === typed.toLowerCase())
    if (!match) {
      setNewCategoryName(typed)
      setAddingCategory(true)
      setCategoryQuery('')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5 sm:mb-6">{t('Transactions (this month)')}</h1>

      <TransactionDetailSheet
        open={!!viewingTxn}
        txn={viewingTxn}
        onClose={() => setViewingTxn(null)}
        onEdit={(txn) => startEdit(txn)}
        onDelete={async (txn) => {
          if (!confirm(t('Delete this transaction? Account balance and dashboard will be updated.'))) return
          await client.delete(`/transactions/${txn.id}`)
          setViewingTxn(null)
          window.dispatchEvent(new CustomEvent('mm-transactions-changed'))
          await loadAll()
        }}
        onSplit={(txn) => {
          setViewingTxn(null)
          navigate(txn.splitBillId ? '/split-bills' : `/split-bills?txnId=${txn.id}`)
        }}
      />

      <TransactionEditSheet
        open={!!editingTxn}
        txn={editingTxn}
        accounts={accounts}
        categories={categories}
        onClose={() => setEditingTxn(null)}
        onSave={{
          update: async (payload) => {
            const { id, ...body } = payload
            await client.put(`/transactions/${id}`, body)
            window.dispatchEvent(new CustomEvent('mm-transactions-changed'))
            await loadAll()
          },
          addCategory: async (name, opts = {}) => {
            const { data } = await client.post('/categories', {
              name,
              essential: opts.essential != null ? !!opts.essential : false,
            })
            setCategories((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]))
            return data
          },
        }}
      />

      {waitingPays.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-amber-500">
                {countWaitingP2pPays()} {t('pending UPI pay(s) waiting for bank SMS')}
              </div>
              <ul className="mt-1.5 space-y-1">
                {waitingPays.slice(0, 3).map((p) => (
                  <li key={p.id} className="text-xs text-slate-500 truncate">
                    ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    {' · '}
                    {p.pn || t('UPI pay')}
                    {!p.reminded ? ` · ${t('reminder in ~15 min if no SMS')}` : ` · ${t('reminder sent')}`}
                  </li>
                ))}
                {waitingPays.length > 3 && (
                  <li className="text-xs text-slate-500">+{waitingPays.length - 3} more</li>
                )}
              </ul>
            </div>
            <Link
              to="/pending-pays"
              className="shrink-0 text-xs font-semibold text-amber-500 px-2 py-1 rounded-md border border-amber-500/40"
            >
              {t('Open')} →
            </Link>
          </div>
        </div>
      )}

      {unloggedPays.length > 0 && (
        <div className="mb-4 rounded-xl border border-teal/30 bg-teal/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-teal">
                {unloggedPays.length} {t('Paid pay(s) not yet in this list')}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('SMS marked them Paid. Tap to save into Transactions.')}
              </p>
            </div>
            <Link
              to="/pending-pays"
              className="shrink-0 text-xs font-semibold text-teal px-2 py-1 rounded-md border border-teal/40"
            >
              {t('Fix')} →
            </Link>
          </div>
        </div>
      )}

      <CollapsibleSection title={t('Add transaction')} addLabel={t('+ Add')} open={formOpen} onOpen={() => setFormOpen(true)}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={t('Account')}>
          <select required value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="w-full">
            <option value="">{t('Account...')}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
              <button type="button" onClick={handleAddCategory} className="px-3 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium">{t('Add')}</button>
              <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryName('') }} className="px-3 py-2 rounded-md border border-slate-300 text-sm">{t('Cancel')}</button>
            </div>
          ) : form.type === 'INCOME' ? (
            <>
              <select
                required
                value={(() => {
                  const cat = categories.find((c) => String(c.id) === String(form.categoryId))
                  if (!cat) return ''
                  if (INCOME_SOURCES.includes(cat.name)) return cat.name
                  return cat.name
                })()}
                onChange={(e) => pickIncomeSource(e.target.value)}
                className="w-full"
              >
                <option value="">{t('Select income category…')}</option>
                {INCOME_SOURCES.map((name) => (
                  <option key={name} value={name}>{t(name)}</option>
                ))}
                {/* Custom income categories the user already created */}
                {categories
                  .filter((c) => !INCOME_SOURCES.includes(c.name) && c.name !== 'Salary')
                  .filter((c) => !['Dining Out', 'Groceries', 'Rent', 'Transport', 'Shopping', 'Entertainment', 'Utilities', 'EMI', 'Insurance', 'Healthcare', 'Education', 'Travel', 'Subscriptions', 'Snacks', 'Drinks'].includes(c.name))
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
                categories={categories}
                value={form.categoryId}
                onChange={(id, cat) => {
                  setForm((f) => ({ ...f, categoryId: id }))
                  setCategoryQuery(cat?.name || '')
                }}
                placeholder={t('Search categories…')}
              />
              <button
                type="button"
                onClick={() => setAddingCategory(true)}
                className="mt-2 text-sm text-brand-500 hover:text-brand-400 font-medium"
              >
                {t('+ New category')}
              </button>
            </>
          )}
        </Field>

        <Field label={t('Type')}>
          <select
            value={form.type}
            onChange={(e) => {
              setAddingCategory(false)
              setNewCategoryName('')
              setCategoryQuery('')
              const nextType = e.target.value
              // Default income to Other so Add works immediately
              const other = nextType === 'INCOME' ? findCategoryByName(categories, 'Other') : null
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

        <Field label={t('Amount')}>
          <input type="number" step="0.01" min="0.01" required placeholder={t('Amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full" />
        </Field>

        <Field label={t('Description')}>
          {(() => {
            const liveBrand = brandFromTxnText(
              form.description,
              categories.find((c) => String(c.id) === form.categoryId)?.name,
            )
            return (
              <div className="flex items-center gap-2">
                {liveBrand && <MerchantLogo brand={liveBrand} size={36} />}
                <input
                  placeholder={t('Description')}
                  required={false}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full"
                />
              </div>
            )
          })()}
        </Field>

        <Field label={t('Date')}>
          <input type="date" required value={form.txnDate} onChange={(e) => setForm({ ...form, txnDate: e.target.value })} className="w-full" />
        </Field>

        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">
            {t('Add')}
          </button>
          <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>
      </CollapsibleSection>

      <MoneyList empty={t('No transactions this month.')}>
        {txnGroups.flatMap((group) => [
          <li
            key={`day-${group.date || 'unknown'}`}
            className="px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-500 bg-slate-50 sticky top-0 z-[1]"
          >
            {formatTxnDayLabel(group.date, t)}
          </li>,
          ...group.items.map((txn) => {
            const row = buildTxnRowDisplay({
              description: txn.description,
              categoryName: txn.categoryName,
              accountName: txn.accountName,
              createdAt: txn.createdAt,
              type: txn.type,
              t,
              formatTime: formatTxnTime,
            })
            return (
              <MoneyRow
                key={txn.id}
                title={row.title}
                meta={row.meta}
                amount={txn.amount}
                income={row.isIncome}
                type={txn.type}
                icon={row.brand ? <MerchantLogo brand={row.brand} size={40} /> : null}
                appName={row.title}
                iconText={row.iconText}
                onClick={() => openTxnDetail(txn)}
                actions={(
                  <>
                    {txn.canSplit && (
                      <RowAction onClick={() => navigate(`/split-bills?txnId=${txn.id}`)} tone="brand">
                        <span>{t('Split')}</span>
                      </RowAction>
                    )}
                    {txn.splitBillId && (
                      <RowAction onClick={() => navigate('/split-bills')} tone="brand">
                        <span>{t('Split ✓')}</span>
                      </RowAction>
                    )}
                    <RowAction onClick={() => startEdit(txn)} tone="brand">
                      <EditIcon />
                      <span>{t('Edit')}</span>
                    </RowAction>
                    <RowAction onClick={() => handleDelete(txn.id)} tone="danger">
                      <DeleteIcon />
                      <span>{t('Delete')}</span>
                    </RowAction>
                  </>
                )}
              />
            )
          }),
        ])}
      </MoneyList>
    </div>
  )
}
