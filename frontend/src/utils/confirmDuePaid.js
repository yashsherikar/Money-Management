import client from '../api/client.js'
import { removeLocalAppNotificationsForRelated } from './localAppNotifications.js'
import { cancelSubscriptionReminders, scheduleSubscriptionReminders } from './subscriptionReminders.js'
import { cancelEmergencyFundReminders, scheduleEmergencyFundReminders } from './emergencyFundReminders.js'

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

/**
 * After paid: drop due reminders so UI no longer says pay.
 * Only schedule the *next* cycle when this period is already confirmed
 * (do not re-fire today's "Subscription due" after Mark paid).
 */
export async function clearPaidReminders(relatedType, relatedId) {
  if (relatedId == null) return
  removeLocalAppNotificationsForRelated(relatedId, [
    'subscription', 'due', 'recurring', 'emergency_fund', 'emi',
  ])
  if (relatedType === RELATED.RECURRING) {
    await cancelSubscriptionReminders(relatedId)
    try {
      const { data } = await client.get('/recurring-transactions')
      const item = (data || []).find((r) => String(r.id) === String(relatedId))
      // Still due / can mark paid → user cleared UI without confirming; do NOT re-nag
      if (item?.active && item.due !== true && item.canMarkPaid !== true) {
        await scheduleSubscriptionReminders(item)
      }
    } catch { /* ignore */ }
  }
  if (relatedType === RELATED.EMERGENCY_FUND) {
    await cancelEmergencyFundReminders(relatedId)
    try {
      const { data } = await client.get('/emergency-fund')
      const plan = (data || []).find((p) => String(p.id) === String(relatedId))
      // Only reschedule next cycle when this month is already confirmed
      if (plan?.active && plan.lastLoggedMonth) {
        const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        if (plan.lastLoggedMonth === ym) {
          await scheduleEmergencyFundReminders(plan)
        }
      }
    } catch { /* ignore */ }
  }
  if (relatedType === RELATED.EMI) {
    removeLocalAppNotificationsForRelated(relatedId, ['emi', 'due'])
  }
}

/** Logs the due item as a real transaction (recurring, EMI, emergency fund). */
export async function confirmDuePaid(relatedType, relatedId) {
  if (!relatedType || relatedId == null) {
    throw new Error('missing due item reference')
  }
  try {
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
  } catch (err) {
    const msg = String(err?.response?.data?.message || err?.message || '')
    // Idempotent: already paid this cycle — still clear reminders
    if (!/already confirmed/i.test(msg)) throw err
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

/** Parse ?confirm= / ?confirmEf= / ?confirmEmi= from reminder URLs. */
export function parseConfirmIdFromUrl(url) {
  if (!url || !url.includes('?')) return null
  try {
    const q = url.startsWith('http') ? new URL(url).searchParams : new URL(url, 'https://app.local').searchParams
    const id = q.get('confirm') || q.get('confirmEf') || q.get('confirmEmi')
    return id ? Number(id) : null
  } catch {
    return null
  }
}
