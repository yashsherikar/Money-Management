import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import client, { networkErrorMessage } from '../api/client'
import { confirmDuePaid, clearPaidReminders, RELATED } from '../utils/confirmDuePaid.js'
import { EditIcon, DeleteIcon } from '../components/icons.jsx'
import DayOfMonthSelect from '../components/DayOfMonthSelect.jsx'
import Field from '../components/Field.jsx'
import CollapsibleSection from '../components/CollapsibleSection.jsx'
import CategoryPicker from '../components/CategoryPicker.jsx'
import MerchantIcon from '../components/MerchantIcon.jsx'
import MoneyRow, { MoneyList, RowAction } from '../components/MoneyRow.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import {
  isSubscriptionRecurring,
  brandFromRecurringDescription,
  SubscriptionLogo,
} from '../utils/subscriptionBrands.jsx'
import { syncAllSubscriptionReminders } from '../utils/subscriptionReminders.js'
import {
  getSubscriptionPauseMeta,
  clearSubscriptionPauseMeta,
} from '../utils/autopayStopDetect.js'

const today = new Date().toISOString().slice(0, 10)
const emptyForm = { accountId: '', categoryId: '', type: 'EXPENSE', amount: '', description: '', recurrenceType: 'MONTHLY', dayOfMonth: '1', lastDoneDate: today, intervalDays: '1' }

export default function Recurring() {
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)
  const [okMsg, setOkMsg] = useState('')
  const [pauseTick, setPauseTick] = useState(0)

  async function loadAll() {
    const [itemsRes, accRes, catRes] = await Promise.all([
      client.get('/recurring-transactions'),
      client.get('/accounts'),
      client.get('/categories'),
    ])
    setItems(itemsRes.data)
    setAccounts(accRes.data)
    setCategories(catRes.data)
    const primary = accRes.data.find((a) => a.isPrimary) || accRes.data[0]
    if (primary) setForm((f) => (f.accountId ? f : { ...f, accountId: String(primary.id) }))
    syncAllSubscriptionReminders(itemsRes.data).catch(() => {})
  }

  useEffect(() => {
    loadAll()
    const onStopped = () => {
      setPauseTick((n) => n + 1)
      loadAll()
    }
    window.addEventListener('mm-autopay-stopped', onStopped)
    window.addEventListener('mm-subscription-pause-changed', onStopped)
    return () => {
      window.removeEventListener('mm-autopay-stopped', onStopped)
      window.removeEventListener('mm-subscription-pause-changed', onStopped)
    }
  }, [])

  useEffect(() => {
    const confirmId = searchParams.get('confirm')
    if (!confirmId) return
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        await confirmDuePaid(RELATED.RECURRING, confirmId)
        if (!cancelled) {
          await loadAll()
        }
      } catch (err) {
        const msg = String(err?.response?.data?.message || err?.message || '')
        if (/already confirmed/i.test(msg)) {
          await clearPaidReminders(RELATED.RECURRING, confirmId).catch(() => {})
          if (!cancelled) await loadAll()
        } else if (!cancelled) {
          setError(err.response?.data?.message || t('Could not mark as paid'))
        }
      } finally {
        if (!cancelled) setSearchParams({}, { replace: true })
      }
    })()
    return () => { cancelled = true }
  }, [searchParams, setSearchParams, t])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOkMsg('')
    try {
      const payload = {
        accountId: Number(form.accountId),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        type: form.type,
        amount: Number(form.amount),
        description: form.description,
        recurrenceType: form.recurrenceType,
        dayOfMonth: form.recurrenceType === 'MONTHLY' ? Number(form.dayOfMonth) : null,
        lastDoneDate: form.recurrenceType === 'INTERVAL_DAYS' ? form.lastDoneDate : null,
        nextDueDate: form.recurrenceType === 'INTERVAL_DAYS'
          ? new Date(new Date(form.lastDoneDate).getTime() + Number(form.intervalDays) * 86400000).toISOString().slice(0, 10)
          : null,
      }
      const wasEdit = !!editingId
      if (wasEdit) {
        await client.put(`/recurring-transactions/${editingId}`, payload)
      } else {
        await client.post('/recurring-transactions', payload)
      }
      resetForm()
      setOkMsg(wasEdit ? t('Updated.') : t('Added.'))
      try {
        await loadAll()
      } catch {
        // Save already succeeded — don't scare the user with a reload error
      }
    } catch (err) {
      setError(networkErrorMessage(err, t('Save failed')))
    }
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setFormOpen(false)
  }

  function startEdit(item) {
    setEditingId(item.id)
    setFormOpen(true)
    setError('')
    setOkMsg('')
    const lastDoneDate = item.nextDueDate && item.intervalDays
      ? new Date(new Date(item.nextDueDate).getTime() - item.intervalDays * 86400000).toISOString().slice(0, 10)
      : today
    setForm({
      accountId: String(item.accountId),
      categoryId: item.categoryId ? String(item.categoryId) : '',
      type: item.type,
      amount: String(item.amount),
      description: item.description,
      recurrenceType: item.recurrenceType,
      dayOfMonth: item.dayOfMonth ? String(item.dayOfMonth) : '1',
      lastDoneDate,
      intervalDays: item.intervalDays ? String(item.intervalDays) : '1',
    })
  }

  async function toggleActive(item) {
    const nextActive = !item.active
    await client.patch(`/recurring-transactions/${item.id}/active?active=${nextActive}`)
    if (nextActive) clearSubscriptionPauseMeta(item.id)
    loadAll()
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this recurring item?'))) return
    await client.delete(`/recurring-transactions/${id}`)
    loadAll()
  }

  async function markPaid(id) {
    setConfirmingId(id)
    setError('')
    try {
      await confirmDuePaid(RELATED.RECURRING, id)
      await loadAll()
    } catch (err) {
      setError(err.response?.data?.message || t('Could not mark as paid'))
    } finally {
      setConfirmingId(null)
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    setError('')
    try {
      const { data } = await client.post('/categories', { name: newCategoryName.trim(), essential: false })
      setCategories((prev) => [...prev, data])
      setForm((f) => ({ ...f, categoryId: String(data.id) }))
      setNewCategoryName('')
      setAddingCategory(false)
    } catch (err) {
      setError(networkErrorMessage(err, t('Could not add category')))
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('Recurring transactions')}</h1>
      <p className="text-sm text-slate-500 mb-6">
        {t('Tap Mark paid on each item after you pay it — that logs it in Transactions and updates your balance.')}
        {' '}
        {t('Bank SMS autopay / savings transfers are detected automatically and saved here + in Transactions.')}
      </p>
      {error && !formOpen && <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      {okMsg && !formOpen && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 p-2 rounded">{okMsg}</div>}

      {(() => {
        const subscriptions = items.filter(isSubscriptionRecurring)
        if (!subscriptions.length) return null
        return (
          <section className="mb-6">
            <h2 className="font-semibold mb-1 text-sm text-slate-500 uppercase tracking-wide">
              {t('Subscriptions')} ({subscriptions.length})
            </h2>
            <p className="text-xs text-slate-500 mb-2">
              {t('Alerts 2 days before, 1 day before, and on the due day — same as other recurring.')}
            </p>
            <MoneyList empty="">
              {subscriptions.map((r) => {
                const brand = brandFromRecurringDescription(r.description)
                const pauseMeta = !r.active ? getSubscriptionPauseMeta(r.id) : null
                // pauseTick forces re-read of local pause meta
                void pauseTick
                const canPay = r.canMarkPaid ?? (r.active && (r.due || r.recurrenceType === 'MONTHLY'))
                const isDue = !!r.due
                const titleName = brand?.name
                  || String(r.description || '').replace(/^(Subscription|Autopay):\s*/i, '')
                const meta = [
                  r.recurrenceType === 'INTERVAL_DAYS'
                    ? `${t('every')} ${r.intervalDays} ${t('days')} · ${t('next')} ${r.nextDueDate}`
                    : `${t('day')} ${r.dayOfMonth} ${t('of every month')}`,
                  r.accountName,
                  isDue ? t('Due soon / due') : null,
                  pauseMeta?.reason === 'autopay_failed_funds'
                    ? t('Paused — bank SMS: autopay failed (low balance)')
                    : pauseMeta?.reason === 'autopay_stopped'
                      ? t('Paused — bank SMS: autopay stopped/cancelled')
                      : null,
                ].filter(Boolean).join(' · ')
                return (
                  <MoneyRow
                    key={r.id}
                    icon={<MerchantIcon brand={brand} name={r.description} size={40} fallback={<SubscriptionLogo brand={null} size={40} />} />}
                    title={(
                      <span className="inline-flex items-center flex-wrap gap-2">
                        {titleName}
                        {r.active && isDue && (
                          <span className="text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded font-semibold">
                            {t('Due')}
                          </span>
                        )}
                        {!r.active && (
                          <span className="text-[10px] uppercase tracking-wide bg-slate-500/15 text-slate-500 px-2 py-0.5 rounded font-semibold">
                            {pauseMeta ? t('Autopay off') : t('paused')}
                          </span>
                        )}
                      </span>
                    )}
                    meta={meta}
                    amount={r.amount}
                    type="EXPENSE"
                    iconText={null}
                    actions={(
                      <>
                        {canPay && (
                          <button
                            type="button"
                            onClick={() => markPaid(r.id)}
                            disabled={confirmingId === r.id}
                            className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 font-medium disabled:opacity-60"
                          >
                            {confirmingId === r.id ? t('Saving…') : t('Mark paid')}
                          </button>
                        )}
                        <RowAction onClick={() => toggleActive(r)}>{r.active ? t('Pause') : t('Resume')}</RowAction>
                        <RowAction onClick={() => startEdit(r)}><EditIcon /><span>{t('Edit')}</span></RowAction>
                        <RowAction onClick={() => handleDelete(r.id)} tone="danger"><DeleteIcon /><span>{t('Delete')}</span></RowAction>
                      </>
                    )}
                  />
                )
              })}
            </MoneyList>
          </section>
        )
      })()}

      <CollapsibleSection title={t('Add recurring transaction')} addLabel={t('+ Add')} open={formOpen} onOpen={() => setFormOpen(true)}>
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
          ) : (
            <CategoryPicker
              categories={categories}
              value={form.categoryId}
              onChange={(id, picked) => {
                if (picked?.name === 'Other') {
                  setAddingCategory(true)
                  setForm({ ...form, categoryId: '' })
                } else {
                  setForm({ ...form, categoryId: id })
                }
              }}
              placeholder={t('No category')}
            />
          )}
        </Field>

        <Field label={t('Type')}>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full">
            <option value="EXPENSE">{t('Expense (recharge, rent, sending to parents...)')}</option>
            <option value="INCOME">{t('Income (salary...)')}</option>
          </select>
        </Field>

        <Field label={t('Description')}>
          <input required placeholder={t('Description (e.g. Mobile recharge, Money to parents)')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full" />
        </Field>

        <Field label={t('Amount')}>
          <input required type="number" step="0.01" min="0.01" placeholder={t('Amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full" />
        </Field>

        <Field label={t('Repeats')}>
          <select value={form.recurrenceType} onChange={(e) => setForm({ ...form, recurrenceType: e.target.value })} className="w-full">
            <option value="MONTHLY">{t('Same day every month')}</option>
            <option value="INTERVAL_DAYS">{t('Every N days (1 = daily, 28 = recharge, etc.)')}</option>
          </select>
        </Field>

        {form.recurrenceType === 'MONTHLY' ? (
          <Field label={t('Day of month')}>
            <DayOfMonthSelect value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} className="w-full" />
          </Field>
        ) : (
          <>
            <Field label={t('Repeat every (days)')}>
              <input
                required
                type="number"
                min="1"
                step="1"
                placeholder={t('e.g. 1 for daily, 28 for a 28-day recharge')}
                value={form.intervalDays}
                onChange={(e) => setForm({ ...form, intervalDays: e.target.value })}
                className="w-full"
              />
            </Field>
            <Field label={t('Starting from')}>
              <input required type="date" value={form.lastDoneDate} onChange={(e) => setForm({ ...form, lastDoneDate: e.target.value })} className="w-full" />
            </Field>
          </>
        )}

        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">
            {editingId ? t('Update recurring transaction') : t('Add recurring transaction')}
          </button>
          <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>
      </CollapsibleSection>

      <h2 className="font-semibold mb-2 text-sm text-slate-500 uppercase tracking-wide">
        {t('Other recurring')}
      </h2>
      <MoneyList empty={t('Nothing set up yet.')}>
        {items.filter((r) => !isSubscriptionRecurring(r)).map((r) => {
          const canPay = r.canMarkPaid ?? (r.active && (r.due || r.recurrenceType === 'MONTHLY'))
          const isDue = !!r.due
          const badges = (
            <>
              {!r.active && <span className="text-xs text-slate-400">({t('paused')})</span>}
              {r.active && isDue && (
                <span className="text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-semibold">
                  {t('Due')}
                </span>
              )}
              {r.active && !canPay && (
                <span className="text-[10px] uppercase tracking-wide bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-semibold">
                  {t('Paid')}
                </span>
              )}
            </>
          )
          const meta = [
            r.recurrenceType === 'INTERVAL_DAYS'
              ? `${t('every')} ${r.intervalDays} ${t('days')} · ${t('next')} ${r.nextDueDate}`
              : `${t('day')} ${r.dayOfMonth} ${t('of every month')}`,
            r.accountName,
            r.categoryName,
          ].filter(Boolean).join(' · ')
          return (
            <MoneyRow
              key={r.id}
              title={(
                <span className="inline-flex items-center flex-wrap gap-2">
                  {r.description}
                  {badges}
                </span>
              )}
              meta={meta}
              amount={r.amount}
              income={r.type === 'INCOME'}
              type={r.type}
              iconText={`${r.description || ''} ${r.categoryName || ''}`}
              appName={r.description}
              actions={(
                <>
                  {canPay && (
                    <button
                      type="button"
                      onClick={() => markPaid(r.id)}
                      disabled={confirmingId === r.id}
                      className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 font-medium disabled:opacity-60"
                    >
                      {confirmingId === r.id ? t('Saving…') : t('Mark paid')}
                    </button>
                  )}
                  <RowAction onClick={() => toggleActive(r)}>{r.active ? t('Pause') : t('Resume')}</RowAction>
                  <RowAction onClick={() => startEdit(r)}><EditIcon /><span>{t('Edit')}</span></RowAction>
                  <RowAction onClick={() => handleDelete(r.id)} tone="danger"><DeleteIcon /><span>{t('Delete')}</span></RowAction>
                </>
              )}
            />
          )
        })}
      </MoneyList>
    </div>
  )
}
