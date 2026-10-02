import { categoryIcon } from '../utils/categoryIcon.js'

/**
 * Shared list row matching the Transactions screen layout:
 * icon · title/meta · amount · optional actions.
 */
export default function MoneyRow({
  title,
  meta,
  amount,
  income = false,
  iconText = '',
  type = 'EXPENSE',
  hideAmount = false,
  trailing = null,
  actions = null,
  onClick,
}) {
  const isIncome = income || type === 'INCOME'
  const showIcon = iconText != null
  return (
    <li
      className={`px-4 py-3.5 sm:px-5 sm:py-4 ${onClick ? 'cursor-pointer active:bg-slate-50/50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3 min-w-0">
        {showIcon && (
          <span
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${
              isIncome ? 'bg-emerald-50' : 'bg-red-50'
            }`}
            aria-hidden="true"
          >
            {categoryIcon(iconText || title || '', isIncome ? 'INCOME' : type)}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[0.95rem] font-semibold text-slate-900 leading-snug break-words">
                {title}
              </div>
              {meta ? (
                <div className="mt-1 text-[0.8rem] text-slate-500 leading-relaxed">{meta}</div>
              ) : null}
            </div>

            {!hideAmount && amount != null && amount !== '' && (
              <div
                className={`shrink-0 text-right text-[0.95rem] font-bold tabular-nums leading-snug ${
                  isIncome ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {typeof amount === 'number' || (typeof amount === 'string' && /^-?\d/.test(amount))
                  ? `${isIncome ? '+' : '−'}₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  : amount}
              </div>
            )}
            {trailing}
          </div>

          {actions ? (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">{actions}</div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function MoneyList({ children, empty }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const emptyList = Array.isArray(items) ? items.length === 0 : !items
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {emptyList ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">{empty}</div>
      ) : (
        <ul className="divide-y divide-slate-100">{children}</ul>
      )}
    </div>
  )
}

export function RowAction({ onClick, tone = 'default', children }) {
  const toneClass =
    tone === 'danger'
      ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
      : tone === 'brand'
        ? 'text-slate-500 hover:text-brand-600 hover:bg-slate-100'
        : 'text-slate-500 hover:text-brand-600 hover:bg-slate-100'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${toneClass}`}
    >
      {children}
    </button>
  )
}
