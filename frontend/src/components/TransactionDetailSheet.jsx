import { useLanguage } from '../context/LanguageContext.jsx'
import { brandFromTxnText, MerchantLogo } from '../utils/subscriptionBrands.jsx'

function money(n, income) {
  const sign = income ? '+' : '−'
  return `${sign}₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="text-sm text-slate-500 shrink-0">{label}</div>
      <div className="text-sm font-medium text-slate-900 text-right break-words">{value}</div>
    </div>
  )
}

/**
 * Tap a transaction → popup with full details (+ Edit / Delete).
 */
export default function TransactionDetailSheet({
  open,
  txn,
  onClose,
  onEdit,
  onDelete,
  onSplit,
}) {
  const { t } = useLanguage()
  if (!open || !txn) return null

  const isIncome = txn.type === 'INCOME'
  const brand = brandFromTxnText(txn.description, txn.categoryName)
  const desc = String(txn.description || '')
  const isAutopay = /^Autopay:/i.test(desc)
  const isSavings = /^Savings/i.test(desc)
  const isSubscription = /^Subscription:/i.test(desc)

  return (
    <div className="fixed inset-0 z-[64] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl m-0 sm:m-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start gap-3 mb-4">
          {brand ? (
            <MerchantLogo brand={brand} size={48} />
          ) : (
            <span className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-red-50'}`}>
              {isIncome ? '💰' : '🧾'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-lg leading-snug break-words">
              {txn.description || txn.categoryName || t('Transaction')}
            </h2>
            <div className={`text-xl font-bold tabular-nums mt-1 ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
              {money(txn.amount, isIncome)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none shrink-0"
            aria-label={t('Close')}
          >
            ×
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 mb-4">
          <Row label={t('Type')} value={isIncome ? t('Income') : t('Expense')} />
          <Row label={t('Date')} value={txn.txnDate} />
          <Row label={t('Account')} value={txn.accountName} />
          <Row label={t('Category')} value={txn.categoryName || t('No category')} />
          <Row label={t('Description')} value={txn.description || '—'} />
          {brand && <Row label={t('Brand')} value={brand.name} />}
          {isAutopay && <Row label={t('Source')} value={t('Autopay · SMS')} />}
          {isSavings && <Row label={t('Source')} value={t('Savings · SMS')} />}
          {isSubscription && <Row label={t('Source')} value={t('Subscription')} />}
          {txn.splitBillId && <Row label={t('Split')} value={t('Split ✓')} />}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onEdit?.(txn)}
            className="w-full bg-brand-600 text-white rounded-md py-2.5 font-medium"
          >
            {t('Edit')}
          </button>
          {txn.canSplit && (
            <button
              type="button"
              onClick={() => onSplit?.(txn)}
              className="w-full border border-slate-300 rounded-md py-2.5 font-medium"
            >
              {t('Split bill')}
            </button>
          )}
          {txn.splitBillId && (
            <button
              type="button"
              onClick={() => onSplit?.(txn)}
              className="w-full border border-slate-300 rounded-md py-2.5 font-medium"
            >
              {t('View split')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete?.(txn)}
            className="w-full text-sm text-red-600 py-2 font-medium"
          >
            {t('Delete')}
          </button>
          <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 py-1">
            {t('Close')}
          </button>
        </div>
      </div>
    </div>
  )
}
