import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'

/** One category per name (case-insensitive). Prefer default / lower id. */
export function dedupeCategories(categories = []) {
  const map = new Map()
  for (const c of categories) {
    if (!c?.name) continue
    const key = String(c.name).trim().toLowerCase()
    if (!key) continue
    const prev = map.get(key)
    if (!prev) {
      map.set(key, c)
      continue
    }
    if (prev.isDefault && !c.isDefault) continue
    if (!prev.isDefault && c.isDefault) {
      map.set(key, c)
      continue
    }
    if (Number(c.id) < Number(prev.id)) map.set(key, c)
  }
  return [...map.values()]
}

/** A–Z, with Other always last. */
export function sortCategoriesAz(categories = []) {
  return [...categories].sort((a, b) => {
    const aOther = String(a.name || '').toLowerCase() === 'other'
    const bOther = String(b.name || '').toLowerCase() === 'other'
    if (aOther !== bOther) return aOther ? 1 : -1
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
  })
}

/**
 * Searchable category dropdown (A–Z). Never lists duplicate names.
 */
export default function CategoryPicker({
  categories = [],
  value = '',
  onChange,
  placeholder,
  disabled = false,
  excludeNames = [],
  className = '',
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const options = useMemo(() => {
    const exclude = new Set(excludeNames.map((n) => String(n).toLowerCase()))
    let list = dedupeCategories(categories).filter((c) => !exclude.has(String(c.name || '').toLowerCase()))
    list = sortCategoriesAz(list)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((c) => String(c.name || '').toLowerCase().includes(q))
    return list
  }, [categories, excludeNames, query])

  const selected = useMemo(
    () => dedupeCategories(categories).find((c) => String(c.id) === String(value)) || null,
    [categories, value],
  )

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-left flex items-center justify-between gap-2 disabled:opacity-60"
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? t(selected.name) || selected.name : (placeholder || t('Select category…'))}
        </span>
        <span className="text-slate-400 text-xs shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search categories…')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">{t('No categories match')}</li>
            ) : (
              options.map((c) => {
                const active = String(c.id) === String(value)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange?.(String(c.id), c)
                        setOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm ${
                        active ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-slate-50'
                      }`}
                    >
                      {t(c.name) || c.name}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
