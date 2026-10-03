import { useEffect, useState } from 'react'
import client from '../api/client'
import { suggestContacts } from '../utils/savedContacts.js'
import { useLanguage } from '../context/LanguageContext.jsx'

/**
 * Type name / email / phone → suggestions from saved contacts + server lookup.
 * onPick({ name, email, phone, upiId })
 */
export default function ContactSuggest({
  value = '',
  onChange,
  onPick,
  placeholder,
  className = 'w-full',
  type = 'text',
}) {
  const { t } = useLanguage()
  const [localHits, setLocalHits] = useState([])
  const [remoteHits, setRemoteHits] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const q = String(value || '').trim()
    setLocalHits(suggestContacts(q, { limit: 5 }))
    if (q.length < 2) {
      setRemoteHits([])
      return undefined
    }
    let cancelled = false
    const tmr = setTimeout(() => {
      client.get('/contacts/lookup', { params: { q } })
        .then((res) => {
          if (!cancelled) setRemoteHits(res.data?.results || [])
        })
        .catch(() => {
          if (!cancelled) setRemoteHits([])
        })
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(tmr)
    }
  }, [value])

  const seen = new Set()
  const merged = []
  for (const c of [...localHits, ...remoteHits]) {
    const key = (c.email || c.phone || c.upiId || c.name || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(c)
  }

  function pick(c) {
    onPick?.({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      upiId: c.upiId || '',
    })
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => {
          onChange?.(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && merged.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {merged.slice(0, 6).map((c) => (
            <li key={c.id || c.email || c.phone || c.name}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
              >
                <div className="font-medium text-slate-800">{c.name || t('Contact')}</div>
                <div className="text-xs text-slate-500 truncate">
                  {[c.email, c.phone, c.upiId].filter(Boolean).join(' · ')}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
