/**
 * Autopay / savings / bank debit-credit SMS → Transactions (+ Recurring).
 * Strong dedupe; if we can't auto-save cleanly → queue for app-open review.
 */
import client from '../api/client'
import { parseBankMoneySms, matchAccountToBank } from './smsBankParse.js'
import {
  smsDedupeKey,
  enqueueSmsMoneyReview,
  hasSmsMoneyReview,
} from './smsMoneyReview.js'
import {
  detectSubscriptionBrand,
  subscriptionLabel,
} from './subscriptionBrands.jsx'
import { scheduleSubscriptionReminders } from './subscriptionReminders.js'

const HISTORY_KEY = 'mm_autopay_history'
const SEEN_KEY = 'mm_autopay_seen'
const MAX_HISTORY = 60
const inFlight = new Set()

function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)))
  try {
    window.dispatchEvent(new CustomEvent('mm-autopay-changed', { detail: { list } }))
  } catch { /* ignore */ }
}

function loadSeen() {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

function rememberSeen(key) {
  const seen = loadSeen()
  seen.add(key)
  const arr = [...seen]
  while (arr.length > 300) arr.shift()
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr))
}

export function listAutopayHistory() {
  return loadHistory()
}

function historyHasDedupe(dedupeKey) {
  return loadHistory().some((h) => h.dedupeKey === dedupeKey)
}

function txnDateFromSms(parsed) {
  const d = parsed?.date ? new Date(parsed.date) : new Date()
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function buildDescription(parsed, accountName, brand) {
  const who = brand?.name || parsed.merchant || (parsed.kind === 'savings' ? 'Savings' : 'Bank')
  const prefix = brand
    ? 'Subscription'
    : parsed.kind === 'savings'
      ? 'Savings'
      : parsed.kind === 'autopay'
        ? 'Autopay'
        : parsed.kind === 'transfer'
          ? 'Transfer'
          : 'Bank SMS'
  const bits = [
    `${prefix}: ${who}`,
    parsed.info,
    accountName && `via ${accountName}`,
  ].filter(Boolean)
  return bits.join(' · ').slice(0, 220)
}

/** Confident category = named match, not bare Other / first fallback. */
function resolveCategory(categories, parsed) {
  if (!categories?.length) return { id: null, confident: false, name: null }
  const preferred = parsed.kind === 'savings'
    ? ['Savings', 'Investment']
    : parsed.kind === 'autopay'
      ? ['Subscription', 'Bills']
      : parsed.direction === 'CREDIT'
        ? ['Salary', 'Freelance', 'Other']
        : ['Bills', 'Food', 'Shopping', 'Travel']

  for (const name of preferred) {
    const hit = categories.find((c) => String(c.name).toLowerCase() === name.toLowerCase())
    if (hit && String(hit.name).toLowerCase() !== 'other') {
      return { id: hit.id, confident: true, name: hit.name }
    }
  }

  // Merchant keyword → category name contains
  const m = String(parsed.merchant || '').toLowerCase()
  if (m) {
    const hit = categories.find((c) => {
      const n = String(c.name).toLowerCase()
      return n !== 'other' && (m.includes(n) || n.includes(m.slice(0, 6)))
    })
    if (hit) return { id: hit.id, confident: true, name: hit.name }
  }

  const other = categories.find((c) => String(c.name).toLowerCase() === 'other')
  return { id: other?.id || null, confident: false, name: other?.name || null }
}

async function alreadyLoggedSimilar(accountId, amount, direction, txnDate) {
  try {
    const { data } = await client.get('/transactions')
    const type = direction === 'CREDIT' ? 'INCOME' : 'EXPENSE'
    return (data || []).some((t) =>
      String(t.accountId) === String(accountId)
      && Number(t.amount) === Number(amount)
      && t.type === type
      && t.txnDate === txnDate
      && /^(Autopay|Savings|Transfer|Bank SMS)/i.test(String(t.description || '')),
    )
  } catch {
    return false
  }
}

function queueReview(parsed, dedupeKey, reason, suggestedAccountId, suggestedCategoryId) {
  return enqueueSmsMoneyReview({
    dedupeKey,
    amount: parsed.amount,
    direction: parsed.direction,
    kind: parsed.kind,
    merchant: parsed.merchant,
    info: parsed.info,
    bankLabel: parsed.bankLabel,
    accountLast4: parsed.accountLast4,
    raw: parsed.raw,
    address: parsed.address,
    suggestedAccountId,
    suggestedCategoryId,
    reason,
    date: parsed.date,
  })
}

/**
 * Process one SMS for bank money (after P2P pending match fails).
 */
export async function processAutopaySms(msg, { accounts, categories } = {}) {
  if (!localStorage.getItem('token')) return null

  const body = msg?.body || msg?.text || ''
  const address = msg?.address || ''
  const parsed = parseBankMoneySms({
    body,
    address,
    date: msg?.date || Date.now(),
    includeUpiPayment: true,
  })
  if (!parsed) return null

  const brand = detectSubscriptionBrand(parsed.raw, parsed.merchant, body, address)
  if (brand && parsed.direction === 'DEBIT') {
    parsed.kind = 'autopay'
    if (!parsed.merchant) parsed.merchant = brand.name
  }

  const dedupeKey = smsDedupeKey({
    amount: parsed.amount,
    direction: parsed.direction,
    body: parsed.raw || body,
    address,
  })

  // Hard dedupe: seen / history / review / in-flight
  if (inFlight.has(dedupeKey) || loadSeen().has(dedupeKey) || historyHasDedupe(dedupeKey) || hasSmsMoneyReview(dedupeKey)) {
    return null
  }
  inFlight.add(dedupeKey)
  rememberSeen(dedupeKey)

  try {
    let accs = accounts
    let cats = categories
    if (!accs?.length || cats == null) {
      const [a, c] = await Promise.all([
        client.get('/accounts').catch(() => ({ data: [] })),
        client.get('/categories').catch(() => ({ data: [] })),
      ])
      accs = accs?.length ? accs : (a.data || [])
      cats = cats?.length ? cats : (c.data || [])
    }

    if (!accs.length) {
      queueReview(parsed, dedupeKey, 'no_account', null, null)
      return { queued: true, reason: 'no_account' }
    }

    if (brand && parsed.kind === 'autopay') {
      // Prefer Subscription category when we know the brand
      const subCat = (cats || []).find((c) => /subscription/i.test(c.name))
      if (subCat) parsed._forcedCategoryId = subCat.id
    }

    let cat = resolveCategory(cats, parsed)
    if (parsed._forcedCategoryId) {
      const forced = cats.find((c) => String(c.id) === String(parsed._forcedCategoryId))
      if (forced) cat = { id: forced.id, confident: true, name: forced.name }
    }
    const preferSavings = parsed.kind === 'savings'
    const account = matchAccountToBank(accs, parsed.bank, { preferSavings })
      || matchAccountToBank(accs, parsed.bank, { preferSavings: false })
    const txnDate = txnDateFromSms(parsed)

    // No bank match confidence for unknown bank + multiple accounts → ask user
    const bankMatched = !!(parsed.bank && account && parsed.bank.keywords.some((k) =>
      String(account.name || '').toLowerCase().includes(k),
    ))
    const canAuto = !!(account && cat.confident && (bankMatched || accs.length === 1 || account.isPrimary))

    if (!canAuto) {
      queueReview(
        parsed,
        dedupeKey,
        !account ? 'no_account' : !cat.confident ? 'needs_category' : 'needs_confirm',
        account?.id || null,
        cat.id,
      )
      return { queued: true, reason: !cat.confident ? 'needs_category' : 'needs_confirm', parsed }
    }

    if (await alreadyLoggedSimilar(account.id, parsed.amount, parsed.direction, txnDate)) {
      return null
    }

    const results = []

    if (parsed.kind === 'savings' && parsed.direction === 'DEBIT') {
      const fromAcc = matchAccountToBank(accs, parsed.bank, { preferSavings: false }) || account
      const toAcc = matchAccountToBank(accs, null, { preferSavings: true })
      if (!fromAcc) {
        queueReview(parsed, dedupeKey, 'no_account', null, cat.id)
        return { queued: true }
      }
      if (!(await alreadyLoggedSimilar(fromAcc.id, parsed.amount, 'DEBIT', txnDate))) {
        const { data: debitTxn } = await client.post('/transactions', {
          accountId: Number(fromAcc.id),
          categoryId: cat.id,
          type: 'EXPENSE',
          amount: Number(parsed.amount),
          description: buildDescription(parsed, fromAcc.name, brand),
          txnDate,
        })
        results.push({ side: 'debit', txn: debitTxn, account: fromAcc })
      }
      if (toAcc && Number(toAcc.id) !== Number(fromAcc.id)
          && !(await alreadyLoggedSimilar(toAcc.id, parsed.amount, 'CREDIT', txnDate))) {
        const desc = `Savings credit · from ${fromAcc.name} · ${parsed.info || parsed.bankLabel || ''}`.trim()
        const { data: creditTxn } = await client.post('/transactions', {
          accountId: Number(toAcc.id),
          categoryId: cat.id,
          type: 'INCOME',
          amount: Number(parsed.amount),
          description: desc.slice(0, 220),
          txnDate,
        })
        results.push({ side: 'credit', txn: creditTxn, account: toAcc })
      }
    } else {
      const { data: txn } = await client.post('/transactions', {
        accountId: Number(account.id),
        categoryId: cat.id,
        type: parsed.direction === 'CREDIT' ? 'INCOME' : 'EXPENSE',
        amount: Number(parsed.amount),
        description: buildDescription(parsed, account.name, brand),
        txnDate,
      })
      results.push({
        side: parsed.direction === 'CREDIT' ? 'credit' : 'debit',
        txn,
        account,
      })

      if (parsed.kind === 'autopay' && parsed.direction === 'DEBIT') {
        const rec = await upsertAutopaySubscription({
          account,
          amount: parsed.amount,
          merchant: parsed.merchant || 'Autopay',
          categoryId: cat.id,
          parsed,
          brand,
        }).catch(() => null)
        if (rec) {
          await scheduleSubscriptionReminders(rec).catch(() => {})
        }
      }
    }

    if (!results.length) {
      queueReview(parsed, dedupeKey, 'not_saved', account?.id, cat.id)
      return { queued: true, reason: 'not_saved' }
    }

    const entry = {
      id: `ap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      dedupeKey,
      kind: parsed.kind,
      direction: parsed.direction,
      amount: Number(parsed.amount),
      merchant: parsed.merchant,
      info: parsed.info,
      bankLabel: parsed.bankLabel,
      accountName: results[0]?.account?.name || '',
      transactionIds: results.map((r) => r.txn?.id).filter(Boolean),
      recurringId: null,
      createdAt: Date.now(),
      raw: parsed.raw,
    }

    try {
      const rec = await findRecurringFor(parsed.merchant || 'Autopay', parsed.amount)
      if (rec) entry.recurringId = rec.id
    } catch { /* ignore */ }

    const hist = loadHistory()
    hist.unshift(entry)
    saveHistory(hist)

    try {
      window.dispatchEvent(new Event('mm-transactions-changed'))
    } catch { /* ignore */ }

    return { parsed, results, entry }
  } catch (err) {
    // API / network failed — ask user later with details
    queueReview(parsed, dedupeKey, 'save_failed', null, null)
    return { queued: true, reason: 'save_failed', error: err?.message }
  } finally {
    inFlight.delete(dedupeKey)
  }
}

async function findRecurringFor(merchant, amount, brand) {
  const { data } = await client.get('/recurring-transactions')
  const brandNeedle = brand?.name?.toLowerCase()
  const needle = String(merchant || '').toLowerCase().slice(0, 24)
  return (data || []).find((r) => {
    const d = String(r.description || '').toLowerCase()
    if (brandNeedle && d.includes(brandNeedle) && Number(r.amount) === Number(amount)) return true
    return Number(r.amount) === Number(amount) && d.includes(needle)
  }) || null
}

async function upsertAutopaySubscription({ account, amount, merchant, categoryId, parsed, brand }) {
  const label = (brand
    ? subscriptionLabel(brand)
    : `Subscription: ${merchant || 'Autopay'}`).slice(0, 80)
  const existing = await findRecurringFor(merchant, amount, brand)
  const day = Math.min(28, Math.max(1, new Date(parsed.date || Date.now()).getDate()))
  if (existing) {
    if (!existing.active) {
      await client.patch(`/recurring-transactions/${existing.id}/active?active=true`).catch(() => {})
    }
    // Refresh description to branded Subscription: if we now know the brand
    if (brand && !String(existing.description || '').toLowerCase().includes(brand.name.toLowerCase())) {
      try {
        await client.put(`/recurring-transactions/${existing.id}`, {
          accountId: Number(existing.accountId || account.id),
          categoryId: existing.categoryId || categoryId || null,
          type: 'EXPENSE',
          amount: Number(existing.amount || amount),
          description: label,
          recurrenceType: existing.recurrenceType || 'MONTHLY',
          dayOfMonth: existing.dayOfMonth || day,
        })
      } catch { /* ignore */ }
    }
    return { ...existing, description: label }
  }
  const { data } = await client.post('/recurring-transactions', {
    accountId: Number(account.id),
    categoryId: categoryId || null,
    type: 'EXPENSE',
    amount: Number(amount),
    description: label,
    recurrenceType: 'MONTHLY',
    dayOfMonth: day,
  })
  return data
}

/** Scan recent inbox for bank money SMS (last 3 days). */
export async function scanInboxForAutopays(SmsReader, { accounts, categories } = {}) {
  if (!SmsReader) return []
  try {
    const sinceMs = Date.now() - 3 * 24 * 60 * 60_000
    const { messages } = await SmsReader.readRecent({ sinceMs, limit: 80 })
    const found = []
    const ordered = [...(messages || [])].sort((a, b) => (a.date || 0) - (b.date || 0))
    for (const msg of ordered) {
      const r = await processAutopaySms(msg, { accounts, categories })
      if (r && (r.entry || r.queued)) found.push(r)
    }
    return found
  } catch {
    return []
  }
}
