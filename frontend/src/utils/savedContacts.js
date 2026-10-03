/**
 * Remember people you pay / split with / ask for money — local suggestions.
 */
import { currentUserId, isLoggedIn, userGetItem, userSetItem } from './userStorage.js'

const KEY = 'mm_saved_contacts'
const MAX = 80

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return digits || ''
}

function load() {
  if (!isLoggedIn()) return []
  try {
    const list = JSON.parse(userGetItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save(list) {
  if (!isLoggedIn()) return
  userSetItem(KEY, JSON.stringify(list.slice(0, MAX)))
}

export function listSavedContacts() {
  return load().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export function upsertSavedContact({
  name = '',
  email = '',
  phone = '',
  upiId = '',
  pa = '',
} = {}) {
  if (!isLoggedIn()) return null
  const n = String(name || '').trim()
  const e = String(email || '').trim().toLowerCase()
  const p = normalizePhone(phone)
  const u = String(upiId || pa || '').trim().toLowerCase()
  // Need a reachable identity — name-only chips wipe email/phone on pick
  if (!e && !p && !u) return null

  const list = load()
  const idx = list.findIndex((c) =>
    (e && c.email === e)
    || (p && c.phone === p)
    || (u && c.upiId === u),
  )
  const next = {
    id: idx >= 0 ? list[idx].id : `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: n || (idx >= 0 ? list[idx].name : ''),
    email: e || (idx >= 0 ? list[idx].email : ''),
    phone: p || (idx >= 0 ? list[idx].phone : ''),
    upiId: u || (idx >= 0 ? list[idx].upiId : ''),
    userId: currentUserId(),
    updatedAt: Date.now(),
  }
  if (idx >= 0) list.splice(idx, 1)
  list.unshift(next)
  save(list)
  return next
}

export function suggestContacts(query, { limit = 6 } = {}) {
  const q = String(query || '').trim().toLowerCase()
  if (q.length < 1) return listSavedContacts().slice(0, limit)
  const phoneQ = normalizePhone(q)
  return listSavedContacts()
    .filter((c) => {
      const hay = `${c.name || ''} ${c.email || ''} ${c.phone || ''} ${c.upiId || ''}`.toLowerCase()
      if (hay.includes(q)) return true
      if (phoneQ && String(c.phone || '').includes(phoneQ)) return true
      return false
    })
    .slice(0, limit)
}

/**
 * Merge people from request/split history into local suggestions.
 * Call when opening Requests / Split so prior friends autofill.
 */
export function ingestContactsFromHistory(list = []) {
  if (!isLoggedIn() || !Array.isArray(list)) return 0
  let n = 0
  for (const c of list) {
    if (!c) continue
    const hit = upsertSavedContact({
      name: c.name || c.payerName || c.requesterName || c.memberName || '',
      email: c.email || c.payerEmail || c.requesterEmail || '',
      phone: c.phone || c.payerPhone || c.requesterPhone || '',
      upiId: c.upiId || c.requesterUpiId || '',
    })
    if (hit) n += 1
  }
  return n
}

/** Pull /contacts/recent + optional local history rows into saved contacts. */
export async function syncContactsFromServer(client, extraRows = []) {
  if (!isLoggedIn() || !client) return listSavedContacts()
  try {
    const { data } = await client.get('/contacts/recent')
    ingestContactsFromHistory(data?.results || [])
  } catch { /* offline / old backend */ }
  if (extraRows.length) ingestContactsFromHistory(extraRows)
  try {
    window.dispatchEvent(new CustomEvent('mm-contacts-changed'))
  } catch { /* ignore */ }
  return listSavedContacts()
}
