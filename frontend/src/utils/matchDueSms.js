/**
 * Match a bank debit SMS amount to recurring / EMI / emergency-fund plans
 * so “forgot expense” can confirm the right due item instead of a generic category.
 */
import client from '../api/client.js'
import { RELATED } from './confirmDuePaid.js'

function amtClose(a, b) {
  return Math.abs(Number(a) - Number(b)) <= 0.011
}

function nameOverlap(merchant, raw, label) {
  const hay = `${merchant || ''} ${raw || ''}`.toLowerCase()
  const needle = String(label || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()
  if (!needle || needle.length < 3) return false
  const token = needle.split(/\s+/).find((t) => t.length >= 3)
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

/** Unique strong match → safe to auto-confirm. */
export function pickConfidentDueMatch(matches) {
  if (!matches?.length) return null
  if (matches.length === 1) return matches[0]
  // Two items same amount — only auto if top score clearly wins
  if (matches[0].score >= matches[1].score + 20) return matches[0]
  return null
}
