import client from '../api/client.js'

export const RELATED = {
  RECURRING: 'RECURRING_TRANSACTION',
  EMERGENCY_FUND: 'EMERGENCY_FUND',
  EMI: 'EMI',
}

/** Tell Dashboard / Transactions to reload after a confirm-from-paid action. */
export function notifyTransactionsChanged() {
  window.dispatchEvent(new CustomEvent('mm-transactions-changed'))
}

/** Logs the due item as a real transaction (recurring, EMI, emergency fund). */
export async function confirmDuePaid(relatedType, relatedId) {
  if (!relatedType || relatedId == null) {
    throw new Error('missing due item reference')
  }
  switch (relatedType) {
    case RELATED.RECURRING:
      await client.post(`/recurring-transactions/${relatedId}/confirm`)
      break
    case RELATED.EMERGENCY_FUND:
      await client.post(`/emergency-fund/${relatedId}/confirm`)
      break
    case RELATED.EMI:
      await client.post(`/emis/${relatedId}/confirm`)
      break
    default:
      throw new Error('unsupported notification type')
  }
  notifyTransactionsChanged()
}

/** Parse ?confirm= from reminder URLs (older pushes without related fields). */
export function parseConfirmIdFromUrl(url) {
  if (!url || !url.includes('?')) return null
  try {
    const q = url.startsWith('http') ? new URL(url).searchParams : new URL(url, 'https://app.local').searchParams
    const id = q.get('confirm')
    return id ? Number(id) : null
  } catch {
    return null
  }
}
