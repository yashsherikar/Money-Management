/**
 * Match a bank debit SMS / QR pay amount to recurring / EMI / emergency-fund plans
 * so “forgot expense” can confirm the right due item instead of a generic category.
 */
import client from '../api/client.js'
import { RELATED, confirmDuePaid } from './confirmDuePaid.js'

function amtClose(a, b) {
  return Math.abs(Number(a) - Number(b)) <= 0.011
}

const WEAK_NAME_TOKENS = new Set([
  'subscription', 'subscriptions', 'payment', 'monthly', 'bank',
  'recurring', 'autopay', 'emi', 'due', 'the', 'and', 'for',
])

function nameOverlap(merchant, raw, label) {
  const hay = `${merchant || ''} ${raw || ''}`.toLowerCase()
  const needle = String(label || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()
  if (!needle || needle.length < 3) return false
  const token = needle.split(/\s+/).find((t) => t.length >= 3 && !WEAK_NAME_TOKENS.has(t))
  return !!(token && hay.includes(token))
}

/**
 * @returns {Promise<Array<{ relatedType, relatedId, label, amount, kind, score }>>}
 */
export async function findDueMatches({ amount, merchant = '', raw = '' } = {}) {
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt < 1) return []

  const matches = []
  const seen = new Set()

  function push(item) {
    const key = `${item.relatedType}:${item.relatedId}`
    if (seen.has(key)) return
    seen.add(key)
    matches.push(item)
  }

  // Due recurring first (highest priority)
  try {
    const { data } = await client.get('/recurring-transactions/due')
    for (const r of data || []) {
      if (!amtClose(r.amount, amt)) continue
      const label = r.description || r.name || 'Recurring'
      push({
        relatedType: RELATED.RECURRING,
        relatedId: r.id,
        label,
        amount: Number(r.amount),
        kind: 'recurring',
        score: 100 + (nameOverlap(merchant, raw, label) ? 20 : 0),
      })
    }
  } catch { /* ignore */ }

  // Active recurring (paid early / not flagged due yet)
  try {
    const { data } = await client.get('/recurring-transactions')
    for (const r of data || []) {
      if (!r.active) continue
      if (!amtClose(r.amount, amt)) continue
      const label = r.description || r.name || 'Recurring'
      push({
        relatedType: RELATED.RECURRING,
        relatedId: r.id,
        label,
        amount: Number(r.amount),
        kind: 'recurring',
        score: 70 + (nameOverlap(merchant, raw, label) ? 25 : 0),
      })
    }
  } catch { /* ignore */ }

  try {
    const { data } = await client.get('/emis')
    for (const e of data || []) {
      if (e.active === false) continue
      if (!amtClose(e.emiAmount, amt)) continue
      const label = e.loanName || e.name || 'EMI'
      push({
        relatedType: RELATED.EMI,
        relatedId: e.id,
        label,
        amount: Number(e.emiAmount),
        kind: 'emi',
        score: 90 + (nameOverlap(merchant, raw, label) ? 15 : 0),
      })
    }
  } catch { /* ignore */ }

  try {
    const { data } = await client.get('/emergency-fund')
    for (const p of data || []) {
      if (p.active === false) continue
      if (!amtClose(p.amount, amt)) continue
      push({
        relatedType: RELATED.EMERGENCY_FUND,
        relatedId: p.id,
        label: 'Emergency fund',
        amount: Number(p.amount),
        kind: 'emergency_fund',
        score: 95,
      })
    }
  } catch { /* ignore */ }

  return matches.sort((a, b) => b.score - a.score)
}

/**
 * Unique strong match → safe to auto-confirm.
 * Amount-only (score &lt; 120) is NOT enough by default — a QR shop pay of ₹199 must not
 * confirm Netflix. Pass allowUniqueAmount for QR pays when only one due has that amount.
 */
export function pickConfidentDueMatch(matches, { allowUniqueAmount = false } = {}) {
  if (!matches?.length) return null
  const top = matches[0]
  // Need name overlap (+20) on top of amount (≥100) — i.e. score ≥ 120
  if (top.score >= 120) {
    if (matches.length === 1) return top
    if (top.score >= matches[1].score + 20) return top
    return null
  }
  // QR: exact unique due amount (₹50 subscription vs only one ₹50 due)
  if (allowUniqueAmount && matches.length === 1 && top.score >= 100) return top
  return null
}

/**
 * After a QR / UPI expense is logged, confirm a matching subscription if confident.
 * @returns {Promise<object|null>} the confirmed match, or null
 */
export async function tryConfirmMatchingDues({
  amount,
  merchant = '',
  raw = '',
  allowUniqueAmount = true,
} = {}) {
  try {
    const matches = await findDueMatches({ amount, merchant, raw })
    const confident = pickConfidentDueMatch(matches, { allowUniqueAmount })
    if (!confident) return null
    await confirmDuePaid(confident.relatedType, confident.relatedId)
    return confident
  } catch {
    return null
  }
}
