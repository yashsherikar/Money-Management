import { useLanguage } from '../context/LanguageContext.jsx'
import { brandFromTxnText, GENERIC_BRAND_IDS } from '../utils/subscriptionBrands.jsx'
import MerchantIcon from './MerchantIcon.jsx'
import { formatTxnDisplay, effectiveMerchantName } from '../utils/txnDisplay.js'
import { useBodyScrollLock } from '../utils/useBodyScrollLock.js'
import ModalPortal from '../utils/ModalPortal.jsx'

function money(n, income) {
  const sign = income ? '+' : '−'
  return `${sign}₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="app-modal-row">
      <div className="app-modal-row-label">{label}</div>
      <div className="app-modal-row-value">{value}</div>
    </div>
  )
}

/** Pull a VPA out of older descriptions that mixed payment id into the text. */
function legacyPaymentId(description) {
  const m = String(description || '').match(/([a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9.\-_]+)/)
  return m ? m[1] : ''
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
  useBodyScrollLock(!!open && !!txn)
  if (!open || !txn) return null

  const isIncome = txn.type === 'INCOME'
  const merchant = effectiveMerchantName(txn.merchantName, txn.accountName)
  const brand = brandFromTxnText(merchant)
    || brandFromTxnText(formatTxnDisplay(txn.description, txn.categoryName).title, txn.categoryName)
  const desc = String(txn.description || '')
  const isAutopay = /^Autopay:/i.test(desc)
  const isSavings = /^Savings/i.test(desc)
  const isSubscription = /^Subscription:/i.test(desc)
  const isTransfer = /^Transfer\s*:/i.test(desc)
  const display = formatTxnDisplay(txn.description, txn.categoryName)
  const baseHeadline = isTransfer || isAutopay || isSavings
    ? (txn.description || txn.categoryName || t('Transaction'))
    : display.title
  // Legal name of a known app ("KIRANAKART TECHNOLOGIES") → app name ("Zepto")
  const merchantBrand = merchant ? brandFromTxnText(merchant) : null
  const merchantTitle = merchantBrand && !GENERIC_BRAND_IDS.has(merchantBrand.id) ? merchantBrand.name : merchant
  const headline = merchant && !isTransfer ? merchantTitle : baseHeadline
  // User's own note when it differs from the merchant ("acko activa insurance")
  const note = merchant && display.title && display.title.toLowerCase() !== merchant.toLowerCase()
    ? display.title : ''
  const detailLine = display.details.join(' · ')

  return (
    <ModalPortal>
    <div className="app-modal" role="dialog" aria-modal="true" aria-labelledby="txn-detail-title">
      <div className="app-modal-backdrop" onClick={onClose} />
      <div className="app-modal-panel">
        <div className="app-modal-body">
          <div className="flex items-start gap-3 mb-4 min-w-0">
            <MerchantIcon
              brand={brand}
              name={isTransfer ? '' : headline}
              altName={note}
              size={48}
              fallback={(
                <span className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  {isIncome ? '💰' : '🧾'}
                </span>
              )}
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <h2 id="txn-detail-title" className="font-bold text-lg leading-snug break-words" style={{ overflowWrap: 'anywhere' }}>
                {headline}
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

          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 mb-4 min-w-0 overflow-hidden">
            <Row label={t('Type')} value={isIncome ? t('Income') : t('Expense')} />
            <Row label={t('Date')} value={txn.txnDate} />
            <Row label={t('Account')} value={txn.accountName} />
            <Row label={t('Category')} value={txn.categoryName || t('No category')} />
            <Row label={merchant ? t('Merchant') : t('Name')} value={headline} />
            <Row label={t('Description')} value={merchant ? (note || '—') : (txn.description || detailLine || '—')} />
            <Row
              label={t('Payment ID')}
              value={txn.paymentId || legacyPaymentId(txn.description) || ''}
            />
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
    </div>
    </ModalPortal>
  )
}
