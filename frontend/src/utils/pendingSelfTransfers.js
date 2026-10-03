/**
 * Unpaired self-transfer SMS legs waiting for the other bank SMS or user pick.
 */
import { currentUserId, isLoggedIn, userGetItem, userSetItem } from './userStorage.js'

const KEY = 'mm_pending_self_transfers'
const MAX = 40
const TTL_MS = 48 * 60 * 60_000

function uid() {
  return `stx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function saveAll(list) {
  if (!isLoggedIn()) return
  userSetItem(KEY, JSON.stringify(list.slice(0, MAX)))
  try {
    window.dispatchEvent(new CustomEvent('mm-self-transfer-changed', { detail: { list } }))
  } catch { /* ignore */ }
}

export function listPendingSelfTransfers() {
  if (!isLoggedIn()) return []
  const uidNow = currentUserId()
  try {
    const list = JSON.parse(userGetItem(KEY) || '[]')
    if (!Array.isArray(list)) return []
    const now = Date.now()
    let changed = false
    const next = list.map((item) => {
      if (!item?.id) return null
      if (item.userId && String(item.userId) !== uidNow) return null
      if ((item.status === 'waiting_pair' || item.status === 'waiting_user')
          && item.createdAt && now - item.createdAt > TTL_MS) {
        changed = true
        return { ...item, status: 'expired', updatedAt: now }
      }
      return item.userId ? item : { ...item, userId: uidNow }
    }).filter(Boolean)
    if (changed) saveAll(next)
    return next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  } catch {
    return []
  }
}

export function addPendingSelfTransfer({
  amount,
  direction,
  fromAccountId = null,
  toAccountId = null,
  bankLabel = '',
  dedupeKey = '',
  raw = '',
  date = Date.now(),
  status = 'waiting_pair',
  debitTxnId = null,
  creditTxnId = null,
} = {}) {
  if (!isLoggedIn() || amount == null) return null
  const item = {
    id: uid(),
    userId: currentUserId(),
    amount: Number(Number(amount).toFixed(2)),
    direction: direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    fromAccountId: fromAccountId != null ? Number(fromAccountId) : null,
    toAccountId: toAccountId != null ? Number(toAccountId) : null,
    bankLabel: bankLabel || '',
    dedupeKey: dedupeKey || '',
    raw: String(raw || '').slice(0, 400),
    date: Number(date) || Date.now(),
    status,
    debitTxnId,
    creditTxnId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const list = listPendingSelfTransfers().filter((x) => x.status !== 'expired')
  list.unshift(item)
  saveAll(list)
  return item
}

export function updatePendingSelfTransfer(id, patch) {
  const list = listPendingSelfTransfers()
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) return null
  list[i] = { ...list[i], ...patch, updatedAt: Date.now() }
  saveAll(list)
  return list[i]
}

export function markSelfTransferCompleted(id, { debitTxnId, creditTxnId } = {}) {
  return updatePendingSelfTransfer(id, {
    status: 'completed',
    debitTxnId: debitTxnId ?? undefined,
    creditTxnId: creditTxnId ?? undefined,
  })
}

/** Find unpaired opposite leg: same amount, within windowMs. */
export function findPairableSelfTransfer(parsed, { windowMs = 2 * 60 * 60_000 } = {}) {
  if (!parsed) return null
  const amt = Number(parsed.amount)
  const smsDate = Number(parsed.date) || Date.now()
  const wantDir = parsed.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT'
  return listPendingSelfTransfers().find((p) => {
    if (p.status !== 'waiting_pair' && p.status !== 'waiting_user') return false
    if (p.direction !== wantDir) return false
    if (Math.abs(Number(p.amount) - amt) > 0.011) return false
    const t = Number(p.date) || Number(p.createdAt) || 0
    return Math.abs(smsDate - t) <= windowMs
  }) || null
}
