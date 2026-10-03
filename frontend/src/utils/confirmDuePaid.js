import client from '../api/client.js'
import { removeLocalAppNotificationsForRelated } from './localAppNotifications.js'
import { cancelSubscriptionReminders, scheduleSubscriptionReminders } from './subscriptionReminders.js'

export const RELATED = {
  RECURRING: 'RECURRING_TRANSACTION',
  EMERGENCY_FUND: 'EMERGENCY_FUND',
  EMI: 'EMI',
}

/** Tell Dashboard / Transactions to reload after a confirm-from-paid action. */
export function notifyTransactionsChanged() {
  window.dispatchEvent(new CustomEvent('mm-transactions-changed'))
  try {
    window.dispatchEvent(new CustomEvent('mm-local-notifications-changed'))
  } catch { /* ignore */ }
}

/** After paid: drop due reminders so UI no longer says pay. */
export async function clearPaidReminders(relatedType, relatedId) {
  if (relatedId == null) return
  removeLocalAppNotificationsForRelated(relatedId, ['subscription', 'due', 'recurring'])
  if (relatedType === RELATED.RECURRING) {
    await cancelSubscriptionReminders(relatedId)
    // Reschedule next cycle if still active
    try {
      const { data } = await client.get('/recurring-transactions')
      const item = (data || []).find((r) => String(r.id) === String(relatedId))
      if (item?.active) await scheduleSubscriptionReminders(item)
    } catch { /* ignore */ }
  }
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
  await clearPaidReminders(relatedType, relatedId)
  notifyTransactionsChanged()
}

/** Clear Pay now on a server notification after user paid. */
export async function clearNotificationPayAction(notificationId) {
  if (!notificationId || String(notificationId).startsWith('local_')) return null
  try {
    const { data } = await client.patch(`/notifications/${notificationId}/clear-pay-action`)
    return data
  } catch {
    return null
  }
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
