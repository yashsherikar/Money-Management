/**
 * Autopay / savings / bank debit-credit SMS → Transactions (+ Recurring).
 * Strong dedupe; if we can't auto-save cleanly → queue for app-open review.
 */
import client from '../api/client'
import { parseBankMoneySms, matchAccountToBank, classifySelfTransfer } from './smsBankParse.js'
import { tryProcessSelfTransferSms } from './selfTransferDetect.js'
import {
  smsDedupeKey,
  enqueueSmsMoneyReview,
  hasSmsMoneyReview,
  dismissSmsMoneyReviewsForSms,
} from './smsMoneyReview.js'
import { listPendingP2pPays } from './pendingP2pPays.js'
import {
  detectSubscriptionBrand,
  subscriptionLabel,
} from './subscriptionBrands.jsx'
import { scheduleSubscriptionReminders } from './subscriptionReminders.js'
import { currentUserId, isLoggedIn, userGetItem, userSetItem } from './userStorage.js'
import { isSmsFromPresent } from './smsListenGate.js'
import { shouldIgnoreMoneySms } from './smsScamFilter.js'
import { findDueMatches, pickConfidentDueMatch } from './matchDueSms.js'
import { confirmDuePaid } from './confirmDuePaid.js'
import { namesLookSame } from './smsPayParse.js'
import { localDateYmd } from './localDate.js'

const HISTORY_KEY = 'mm_autopay_history'
const SEEN_KEY = 'mm_autopay_seen'
const MAX_HISTORY = 60
const inFlight = new Set()

function loadHistory() {
  if (!isLoggedIn()) return []
  try {
    const list = JSON.parse(userGetItem(HISTORY_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveHistory(list) {
  if (!isLoggedIn()) return
  userSetItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)))
  try {
    window.dispatchEvent(new CustomEvent('mm-autopay-changed', { detail: { list } }))
  } catch { /* ignore */ }
}

function loadSeen() {
  if (!isLoggedIn()) return new Set()
  try {
    const list = JSON.parse(userGetItem(SEEN_KEY) || '[]')
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

function rememberSeen(key) {
  if (!isLoggedIn() || !key) return
  const seen = loadSeen()
  seen.add(key)
  const arr = [...seen]
  while (arr.length > 300) arr.shift()
  userSetItem(SEEN_KEY, JSON.stringify(arr))
}

/**
 * Call after Pay-now / P2P SMS is already logged — stops forgot-expense popup
 * for the same bank debit SMS.
 */
export function markSmsConsumedByPayConfirm({
  body = '',
  address = '',
  amount = null,
  date = Date.now(),
} = {}) {
  if (!isLoggedIn()) return
  const text = String(body || '')
  const parsed = parseBankMoneySms({
    body: text,
    address,
    date,
    includeUpiPayment: true,
  })
  const amt = amount != null ? Number(amount) : (parsed ? Number(parsed.amount) : null)
  const dir = parsed?.direction || 'DEBIT'
  // Mark both raw + full body so reopen/re-parse cannot miss the seen key
  if (amt != null) {
    rememberSeen(smsDedupeKey({ amount: amt, direction: dir, body: text, address }))
    if (parsed?.raw && parsed.raw !== text) {
      rememberSeen(smsDedupeKey({
        amount: amt,
        direction: dir,
        body: parsed.raw,
        address,
      }))
    }
  }
  // Drop any already-queued "forgot expense" for this SMS
  dismissSmsMoneyReviewsForSms({
    body: text,
    address,
    amount: amount ?? parsed?.amount,
  })
}

export function listAutopayHistory() {
  return loadHistory()
}

function historyHasDedupe(dedupeKey) {
  return loadHistory().some((h) => h.dedupeKey === dedupeKey)
}

/** Identity overlap between bank SMS and a pending Pay row (VPA / payee name). */
function pendingIdentityMatches(parsed, pending) {
  const smsPa = String(parsed.pa || '').toLowerCase()
  const pendingPa = String(pending.pa || '').toLowerCase()
  if (pendingPa && smsPa && pendingPa === smsPa) return true
  if (namesLookSame(parsed.merchant || parsed.payeeName, pending.pn || pending.name)) return true
  // Confirmed + already in ledger: allow nameless SMS to suppress forgot-expense
  if (pending.status === 'confirmed' && pending.transactionLogged
      && !parsed.merchant && !parsed.payeeName && !smsPa) {
    return true
  }
  return false
}

/** Same debit already confirmed via Pay now / payment request SMS match. */
function matchesConfirmedPayNow(parsed) {
  if (!parsed || parsed.direction !== 'DEBIT') return false
  const amt = Number(parsed.amount)
  const smsDate = Number(parsed.date) || Date.now()
  return listPendingP2pPays().some((p) => {
    if (p.status !== 'confirmed' && p.status !== 'waiting_sms') return false
    if (Math.abs(Number(p.amount) - amt) > 0.011) return false
    const created = Number(p.createdAt) || 0
    const confirmed = Number(p.confirmedAt) || created
    // SMS within pay window (2 min before create → 24h after)
    if (smsDate < created - 2 * 60_000) return false
    if (smsDate > confirmed + 24 * 60 * 60_000) return false
    // Never block unrelated same-₹ debits — require VPA/name overlap
    return pendingIdentityMatches(parsed, p)
  })
}

function txnDateFromSms(parsed) {
  return localDateYmd(parsed?.date || Date.now())
}

function formatBankLabel(label) {
  const raw = String(label || '').trim()
  if (!raw || /^paytm$/i.test(raw)) return ''
  const name = raw.replace(/\s*bank\s*$/i, '').trim().toUpperCase()
  if (!name) return ''
  return `${name} Bank`
}

function buildDescription(parsed, accountName, brand) {
  const who = brand?.name || parsed.merchant || (parsed.kind === 'savings' ? 'Savings' : 'Bank')

  // Cashback: Paytm · ICICI Bank  (no UPI ref / A/c)
  if (parsed.kind === 'cashback') {
    const bank = formatBankLabel(parsed.bankLabel || parsed.bank?.id)
    return [`Cashback: ${who}`, bank].filter(Boolean).join(' · ').slice(0, 220)
  }
  if (parsed.kind === 'refund') {
    const bank = formatBankLabel(parsed.bankLabel || parsed.bank?.id)
    return [`Refund: ${who}`, bank].filter(Boolean).join(' · ').slice(0, 220)
  }
  if (parsed.kind === 'interest') {
    const bank = formatBankLabel(parsed.bankLabel || parsed.bank?.id)
    return [`Interest: ${who === 'Bank' ? 'Savings' : who}`, bank].filter(Boolean).join(' · ').slice(0, 220)
  }

  const prefix = parsed.direction === 'CREDIT'
    ? 'Credit'
    : brand
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
    parsed.upiRef && `UPI ${parsed.upiRef}`,
    parsed.bankLabel && parsed.bankLabel !== 'PAYTM' && String(parsed.bankLabel),
    parsed.accountLast4 && `A/c …${parsed.accountLast4}`,
    accountName && `via ${accountName}`,
  ].filter(Boolean)

  return bits.join(' · ').slice(0, 220)
}

/** Confident category = named match, not bare Other / first fallback. */
function resolveCategory(categories, parsed) {
  if (!categories?.length) return { id: null, confident: false, name: null }
  const preferred = parsed.kind === 'cashback'
    ? ['Cashback', 'Freelance', 'Other']
    : parsed.kind === 'refund'
      ? ['Refund', 'Cashback', 'Other', 'Freelance']
      : parsed.kind === 'interest'
        ? ['Interest', 'Savings', 'Investment', 'Other']
        : parsed.kind === 'savings'
          ? ['Savings', 'Investment']
          : parsed.kind === 'autopay'
            ? ['Subscription', 'Bills']
            : parsed.direction === 'CREDIT'
              ? (/\bsalary\b/i.test(String(parsed.raw || ''))
                ? ['Salary', 'Freelance', 'Other']
                : ['Freelance', 'Other', 'Salary'])
              : ['Bills', 'Food', 'Shopping', 'Travel']

  const autoOtherKinds = new Set(['cashback', 'refund', 'interest'])
  for (const name of preferred) {
    const hit = categories.find((c) => String(c.name).toLowerCase() === name.toLowerCase())
    if (!hit) continue
    const isOther = String(hit.name).toLowerCase() === 'other'
    // Cashback / refund / interest may only have Other — still auto-save
    if (!isOther || autoOtherKinds.has(parsed.kind)) {
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
      && /^(Cashback|Refund|Interest|Credit|Autopay|Savings|Transfer|Bank SMS|Subscription)/i.test(String(t.description || '')),
    )
  } catch {
    return false
  }
}

function queueReview(parsed, dedupeKey, reason, suggestedAccountId, suggestedCategoryId, matchedDues = null) {
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
    matchedDues,
    reason,
    date: parsed.date,
  })
}

/**
 * Process one SMS for bank money (after P2P pending match fails).
 */
export async function processAutopaySms(msg, { accounts, categories } = {}) {
  // Only the logged-in user — never populate another account's SMS queue
  if (!isLoggedIn()) return null
  if (!isSmsFromPresent(msg)) return null

  const body = msg?.body || msg?.text || ''
  const address = msg?.address || ''
  if (shouldIgnoreMoneySms({ body, address })) return null

  const parsed = parseBankMoneySms({
    body,
    address,
    date: msg?.date || Date.now(),
    includeUpiPayment: true,
  })
  if (!parsed) return null

  const brand = detectSubscriptionBrand(parsed.raw, parsed.merchant, body, address)

  const dedupeKey = smsDedupeKey({
    amount: parsed.amount,
    direction: parsed.direction,
    body: parsed.raw || body,
    address,
  })
  // Scope in-flight lock per user so two accounts on one phone don't collide
  const flightKey = `${currentUserId()}|${dedupeKey}`

  // Hard dedupe: seen / history / review / in-flight (this user only)
  if (inFlight.has(flightKey) || loadSeen().has(dedupeKey) || historyHasDedupe(dedupeKey) || hasSmsMoneyReview(dedupeKey)) {
    return null
  }

  // Already handled as Pay-now / payment-request / P2P → never ask category again
  if (matchesConfirmedPayNow(parsed)) {
    rememberSeen(dedupeKey)
    dismissSmsMoneyReviewsForSms({
      body: parsed.raw || body,
      address,
      amount: parsed.amount,
    })
    return null
  }

  inFlight.add(flightKey)
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

    // Own bank → own bank (2+ accounts): Transfer: A → B, not spend/earn
    // Run before brand→autopay so IMPS/UPI self-moves are not treated as subscriptions
    if (accs.length >= 2 && (parsed.kind === 'transfer' || classifySelfTransfer(parsed, accs))) {
      try {
        const stx = await tryProcessSelfTransferSms(parsed, {
          accounts: accs,
          categories: cats,
          dedupeKey,
        })
        if (stx?.selfTransfer) {
          return stx
        }
      } catch { /* fall through to normal path */ }
    }

    if (brand && parsed.direction === 'DEBIT'
        && parsed.kind !== 'transfer' && parsed.kind !== 'self_transfer') {
      parsed.kind = 'autopay'
      if (!parsed.merchant) parsed.merchant = brand.name
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

    // Debit SMS amount matches recurring / EMI / emergency fund → confirm that, not generic category
    let matchedDues = null
    if (parsed.direction === 'DEBIT' && parsed.kind !== 'cashback') {
      try {
        matchedDues = await findDueMatches({
          amount: parsed.amount,
          merchant: parsed.merchant,
          raw: parsed.raw || body,
        })
        const confident = pickConfidentDueMatch(matchedDues)
        if (confident) {
          await confirmDuePaid(confident.relatedType, confident.relatedId)
          return { dueConfirmed: confident }
        }
      } catch { /* fall through to normal path */ }
    }

    // No bank match confidence for unknown bank + multiple accounts → ask user
    const bankMatched = !!(parsed.bank && account && parsed.bank.keywords.some((k) =>
      String(account.name || '').toLowerCase().includes(k),
    ))
    // Wallet / refund / interest credits: prefer auto-post when we have account+category
    const easyCredit = parsed.kind === 'cashback' || parsed.kind === 'refund' || parsed.kind === 'interest'
    if (easyCredit && account && cat.id) {
      cat = { ...cat, confident: true }
    }
    const canAuto = !!(account && cat.confident && (
      bankMatched
      || accs.length === 1
      || account.isPrimary
      || easyCredit
    ))

    if (!canAuto) {
      queueReview(
        parsed,
        dedupeKey,
        !account ? 'no_account' : !cat.confident ? 'needs_category' : 'needs_confirm',
        account?.id || null,
        cat.id,
        matchedDues?.length ? matchedDues : null,
      )
      return { queued: true, reason: !cat.confident ? 'needs_category' : 'needs_confirm', parsed }
    }

    // Plain payment debit whose amount matches EMI/recurring/EF — ask which, don't silent-miscategorize
    if (matchedDues?.length && (parsed.kind === 'payment' || parsed.kind === 'transfer') && !brand) {
      queueReview(
        parsed,
        dedupeKey,
        'due_match',
        account?.id || null,
        cat.id,
        matchedDues,
      )
      return { queued: true, reason: 'due_match', parsed }
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
      userId: currentUserId(),
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
    inFlight.delete(flightKey)
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

/**
 * Drain live SMS queued while app was killed (not inbox history).
 */
export async function scanInboxForAutopays() {
  const { drainLiveSmsQueue } = await import('./smsPayWatch.js')
  return drainLiveSmsQueue()
}
