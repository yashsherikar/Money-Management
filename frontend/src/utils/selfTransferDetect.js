/**
 * Log self-transfers (own bank → own bank) from SMS as paired Transfer: A → B.
 */
import client from '../api/client'
import {
  classifySelfTransfer,
  transferDescription,
  isTransferDescription,
} from './smsBankParse.js'
import {
  addPendingSelfTransfer,
  findPairableSelfTransfer,
  markSelfTransferCompleted,
  updatePendingSelfTransfer,
  listPendingSelfTransfers,
} from './pendingSelfTransfers.js'
import { enqueueSmsMoneyReview } from './smsMoneyReview.js'

function txnDateFromSms(parsed) {
  const d = parsed?.date ? new Date(parsed.date) : new Date()
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function pickTransferCategory(categories) {
  if (!categories?.length) return null
  const preferred = ['Transfer', 'Other', 'Savings']
  for (const name of preferred) {
    const hit = categories.find((c) => String(c.name).toLowerCase() === name.toLowerCase())
    if (hit) return hit
  }
  return categories[0] || null
}

async function alreadyHasTransferLeg(accountId, amount, type, txnDate) {
  try {
    const { data } = await client.get('/transactions')
    return (data || []).some((t) =>
      String(t.accountId) === String(accountId)
      && Number(t.amount) === Number(amount)
      && t.type === type
      && t.txnDate === txnDate
      && isTransferDescription(t.description),
    )
  } catch {
    return false
  }
}

/**
 * Post both legs (or the missing one) for a self-transfer.
 */
export async function postSelfTransferPair({
  fromAccount,
  toAccount,
  amount,
  txnDate,
  categoryId,
  existingDebitTxnId = null,
  existingCreditTxnId = null,
} = {}) {
  if (!fromAccount?.id || !toAccount?.id) {
    return { ok: false, error: 'need_both_accounts' }
  }
  if (String(fromAccount.id) === String(toAccount.id)) {
    return { ok: false, error: 'same_account' }
  }
  const desc = transferDescription(fromAccount.name, toAccount.name)
  const amt = Number(amount)
  const results = []
  let debitTxnId = existingDebitTxnId
  let creditTxnId = existingCreditTxnId

  if (!debitTxnId && !(await alreadyHasTransferLeg(fromAccount.id, amt, 'EXPENSE', txnDate))) {
    const { data } = await client.post('/transactions', {
      accountId: Number(fromAccount.id),
      categoryId: categoryId || null,
      type: 'EXPENSE',
      amount: amt,
      description: desc,
      txnDate,
    })
    debitTxnId = data?.id || null
    results.push({ side: 'debit', txn: data })
  }

  if (!creditTxnId && !(await alreadyHasTransferLeg(toAccount.id, amt, 'INCOME', txnDate))) {
    const { data } = await client.post('/transactions', {
      accountId: Number(toAccount.id),
      categoryId: categoryId || null,
      type: 'INCOME',
      amount: amt,
      description: desc,
      txnDate,
    })
    creditTxnId = data?.id || null
    results.push({ side: 'credit', txn: data })
  }

  try {
    window.dispatchEvent(new Event('mm-transactions-changed'))
  } catch { /* ignore */ }

  return { ok: true, description: desc, debitTxnId, creditTxnId, results }
}

/**
 * Try to handle SMS as own-account transfer.
 * @returns {null | object} null = not a self-transfer, let autopay continue
 */
export async function tryProcessSelfTransferSms(parsed, {
  accounts = [],
  categories = [],
  dedupeKey = '',
} = {}) {
  if (!parsed || accounts.length < 2) return null

  const classified = classifySelfTransfer(parsed, accounts)
  if (!classified) return null

  parsed.kind = 'self_transfer'
  const cat = pickTransferCategory(categories)
  const txnDate = txnDateFromSms(parsed)
  const pair = findPairableSelfTransfer(parsed)

  // CREDIT SMS: complete a waiting debit, or wait / ask
  if (parsed.direction === 'CREDIT') {
    const toAccount = classified.toAccount
    let fromAccount = classified.fromAccount

    if (pair?.fromAccountId) {
      fromAccount = accounts.find((a) => String(a.id) === String(pair.fromAccountId)) || fromAccount
    }

    if (fromAccount && toAccount) {
      const posted = await postSelfTransferPair({
        fromAccount,
        toAccount,
        amount: parsed.amount,
        txnDate,
        categoryId: cat?.id,
        existingDebitTxnId: pair?.debitTxnId || null,
      })
      if (pair) {
        markSelfTransferCompleted(pair.id, {
          debitTxnId: posted.debitTxnId,
          creditTxnId: posted.creditTxnId,
        })
      } else {
        addPendingSelfTransfer({
          amount: parsed.amount,
          direction: 'CREDIT',
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          bankLabel: parsed.bankLabel,
          dedupeKey,
          raw: parsed.raw,
          date: parsed.date,
          status: 'completed',
          debitTxnId: posted.debitTxnId,
          creditTxnId: posted.creditTxnId,
        })
      }
      return { selfTransfer: true, posted, paired: !!pair }
    }

    // Credit first, destination known, source unknown → wait for debit or user
    addPendingSelfTransfer({
      amount: parsed.amount,
      direction: 'CREDIT',
      fromAccountId: fromAccount?.id || null,
      toAccountId: toAccount?.id || null,
      bankLabel: parsed.bankLabel,
      dedupeKey,
      raw: parsed.raw,
      date: parsed.date,
      status: fromAccount ? 'waiting_pair' : 'waiting_user',
    })

    if (!fromAccount) {
      enqueueSmsMoneyReview({
        dedupeKey,
        amount: parsed.amount,
        direction: 'CREDIT',
        kind: 'self_transfer',
        merchant: parsed.merchant,
        info: parsed.info,
        bankLabel: parsed.bankLabel,
        accountLast4: parsed.accountLast4,
        raw: parsed.raw,
        address: parsed.address,
        suggestedAccountId: toAccount?.id || null,
        suggestedCategoryId: cat?.id || null,
        suggestedToAccountId: toAccount?.id || null,
        reason: 'needs_destination',
        date: parsed.date,
      })
      return { selfTransfer: true, queued: true, reason: 'needs_destination' }
    }
    return { selfTransfer: true, waiting: true }
  }

  // DEBIT SMS
  const fromAccount = classified.fromAccount
  let toAccount = classified.toAccount

  if (pair?.toAccountId) {
    toAccount = accounts.find((a) => String(a.id) === String(pair.toAccountId)) || toAccount
  }

  if (fromAccount && toAccount) {
    const posted = await postSelfTransferPair({
      fromAccount,
      toAccount,
      amount: parsed.amount,
      txnDate,
      categoryId: cat?.id,
      existingCreditTxnId: pair?.creditTxnId || null,
    })
    if (pair) {
      markSelfTransferCompleted(pair.id, {
        debitTxnId: posted.debitTxnId,
        creditTxnId: posted.creditTxnId,
      })
    } else {
      addPendingSelfTransfer({
        amount: parsed.amount,
        direction: 'DEBIT',
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        bankLabel: parsed.bankLabel,
        dedupeKey,
        raw: parsed.raw,
        date: parsed.date,
        status: 'completed',
        debitTxnId: posted.debitTxnId,
        creditTxnId: posted.creditTxnId,
      })
    }
    return { selfTransfer: true, posted, paired: !!pair }
  }

  // Debit known, destination unknown → ask which of my accounts
  const pending = addPendingSelfTransfer({
    amount: parsed.amount,
    direction: 'DEBIT',
    fromAccountId: fromAccount?.id || null,
    toAccountId: null,
    bankLabel: parsed.bankLabel,
    dedupeKey,
    raw: parsed.raw,
    date: parsed.date,
    status: 'waiting_user',
  })

  enqueueSmsMoneyReview({
    dedupeKey,
    amount: parsed.amount,
    direction: 'DEBIT',
    kind: 'self_transfer',
    merchant: parsed.merchant,
    info: parsed.info,
    bankLabel: parsed.bankLabel,
    accountLast4: parsed.accountLast4,
    raw: parsed.raw,
    address: parsed.address,
    suggestedAccountId: fromAccount?.id || null,
    suggestedCategoryId: cat?.id || null,
    suggestedToAccountId: null,
    pendingSelfTransferId: pending?.id || null,
    reason: 'needs_destination',
    date: parsed.date,
  })

  return { selfTransfer: true, queued: true, reason: 'needs_destination' }
}

/** Complete a review where user picked destination account. */
export async function confirmSelfTransferFromReview(item, {
  fromAccountId,
  toAccountId,
  accounts = [],
  categories = [],
} = {}) {
  const fromAccount = accounts.find((a) => String(a.id) === String(fromAccountId))
  const toAccount = accounts.find((a) => String(a.id) === String(toAccountId))
  if (!fromAccount || !toAccount) {
    throw new Error('Pick both source and destination accounts')
  }
  const cat = pickTransferCategory(categories)
  const txnDate = item?.date
    ? new Date(item.date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const posted = await postSelfTransferPair({
    fromAccount,
    toAccount,
    amount: item.amount,
    txnDate,
    categoryId: cat?.id,
  })

  if (item.pendingSelfTransferId) {
    markSelfTransferCompleted(item.pendingSelfTransferId, {
      debitTxnId: posted.debitTxnId,
      creditTxnId: posted.creditTxnId,
    })
  } else {
    // Mark any waiting pair with same amount
    const hit = listPendingSelfTransfers().find((p) =>
      (p.status === 'waiting_pair' || p.status === 'waiting_user')
      && Math.abs(Number(p.amount) - Number(item.amount)) < 0.011,
    )
    if (hit) {
      markSelfTransferCompleted(hit.id, {
        debitTxnId: posted.debitTxnId,
        creditTxnId: posted.creditTxnId,
      })
    }
  }

  return posted
}

export { updatePendingSelfTransfer }
