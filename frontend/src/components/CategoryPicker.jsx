import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
 * Menu is portaled + fixed so it works inside overflow-hidden modals.
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
  const [menuBox, setMenuBox] = useState(null)
  const rootRef = useRef(null)
  const menuRef = useRef(null)

  const options = useMemo(() => {
    const exclude = new Set(excludeNames.map((n) => String(n).toLowerCase()))
    let list = dedupeCategories(categories).filter((c) => !exclude.has(String(c.name || '').toLowerCase()))
    list = sortCategoriesAz(list)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((c) => String(c.name || '').toLowerCase().includes(q))
    return list
  }, [categories, excludeNames, query])

  const selected = useMemo(() => {
    const list = dedupeCategories(categories)
    const byId = list.find((c) => String(c.id) === String(value))
    if (byId) return byId
    // Stale user-clone id (dedupe prefers default) → match by name so picker isn't blank
    const raw = categories.find((c) => String(c.id) === String(value))
    if (raw?.name) {
      const byName = list.find(
        (c) => String(c.name).toLowerCase() === String(raw.name).toLowerCase(),
      )
      if (byName) return byName
    }
    return null
  }, [categories, value])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuBox(null)
      return undefined
    }
    function place() {
      const r = rootRef.current.getBoundingClientRect()
      const maxH = 256
      const spaceBelow = window.innerHeight - r.bottom - 12
      const spaceAbove = r.top - 12
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow
      const height = Math.min(maxH, openUp ? spaceAbove : spaceBelow)
      setMenuBox({
        left: r.left,
        width: r.width,
        top: openUp ? undefined : r.bottom + 4,
        bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
        maxHeight: Math.max(140, height),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      const t = e.target
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])

  function pick(c) {
    onChange?.(String(c.id), c)
    setOpen(false)
  }

  const menu = open && menuBox
    ? createPortal(
      <div
        ref={menuRef}
        className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden flex flex-col"
        style={{
          position: 'fixed',
          zIndex: 200,
          left: menuBox.left,
          width: menuBox.width,
          top: menuBox.top,
          bottom: menuBox.bottom,
          maxHeight: menuBox.maxHeight,
        }}
      >
        <div className="p-2 border-b border-slate-100 shrink-0">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search categories…')}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
        <ul className="overflow-y-auto py-1 flex-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">{t('No categories match')}</li>
          ) : (
            options.map((c) => {
              const active = selected
                ? String(c.id) === String(selected.id)
                : String(c.id) === String(value)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      pick(c)
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      pick(c)
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
      </div>,
      document.body,
    )
    : null

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
      {menu}
    </div>
  )
}
