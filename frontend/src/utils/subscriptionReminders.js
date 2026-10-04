/**
 * Local alerts for subscriptions: 2 days before, 1 day before, due day
 * (same cadence as backend push reminders).
 */
import { Capacitor } from '@capacitor/core'
import { addLocalAppNotification, removeLocalAppNotificationsForRelated } from './localAppNotifications.js'
import { isSubscriptionRecurring, brandFromRecurringDescription } from './subscriptionBrands.jsx'

const NOTIF_BASE = 82000
const CHANNEL = 'subscriptions'

function notifId(recurringId, leadDays) {
  const id = Number(recurringId) || 0
  return NOTIF_BASE + (id % 8000) * 3 + (leadDays === 2 ? 0 : leadDays === 1 ? 1 : 2)
}

async function getLN() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const mod = await import('@capacitor/local-notifications')
    return mod.LocalNotifications
  } catch {
    return null
  }
}

function nextDueDate(item) {
  if (!item?.active) return null
  if (item.recurrenceType === 'INTERVAL_DAYS' && item.nextDueDate) {
    return new Date(`${item.nextDueDate}T09:00:00`)
  }
  const day = Math.min(28, Number(item.dayOfMonth) || 1)
  const now = new Date()
  let y = now.getFullYear()
  let m = now.getMonth()
  let candidate = new Date(y, m, day, 9, 0, 0)
  // If already past this month's due (or paid this cycle), next month
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (candidate < todayStart || !item.canMarkPaid && item.due === false) {
    m += 1
    if (m > 11) { m = 0; y += 1 }
    candidate = new Date(y, m, day, 9, 0, 0)
  }
  return candidate
}

function whenLabel(leadDays) {
  if (leadDays === 0) return 'is due today'
  if (leadDays === 1) return 'is due tomorrow'
  return `is due in ${leadDays} days`
}

/** Daily / every-1-day autopay: bank already debits — no reminder spam. */
export function isDailyRecurring(item) {
  if (!item || item.recurrenceType !== 'INTERVAL_DAYS') return false
  const days = Number(item.intervalDays)
  return !Number.isFinite(days) || days <= 1
}

function shouldScheduleRecurringReminder(item) {
  if (!item?.active || !item?.id) return false
  if (isDailyRecurring(item)) return false
  // Subscriptions / autopay brands, monthly dues, or multi-day interval cycles
  if (isSubscriptionRecurring(item)) return true
  if (item.recurrenceType === 'MONTHLY') return true
  if (item.recurrenceType === 'INTERVAL_DAYS' && Number(item.intervalDays) > 1) return true
  return false
}

function titleForLead(item, lead) {
  const sub = isSubscriptionRecurring(item)
  if (lead === 0) return sub ? 'Subscription due today' : 'Due today'
  if (lead === 1) return sub ? 'Subscription due tomorrow' : 'Due tomorrow'
  return sub ? `Subscription due in ${lead} days` : `Due in ${lead} days`
}

/**
 * Schedule local notifications for recurring / subscription / autopay
 * (2d / 1d / due day @ 9am). Skips daily autopay.
 */
export async function scheduleSubscriptionReminders(item) {
  if (!shouldScheduleRecurringReminder(item)) {
    await cancelSubscriptionReminders(item?.id)
    return
  }
  const due = nextDueDate(item)
  if (!due || Number.isNaN(due.getTime())) return

  const brand = brandFromRecurringDescription(item.description)
  const name = brand?.name || item.description || 'Payment'
  const amt = Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
  const intervalDays = item.recurrenceType === 'INTERVAL_DAYS'
    ? Number(item.intervalDays) || 999
    : 999
  const leads = [2, 1, 0].filter((lead) => lead < intervalDays)

  const LN = await getLN()
  if (LN) {
    try {
      const perm = await LN.checkPermissions()
      if (perm.display !== 'granted') await LN.requestPermissions()
      const again = await LN.checkPermissions()
      if (again.display === 'granted') {
        const toCancel = [2, 1, 0].map((d) => ({ id: notifId(item.id, d) }))
        try { await LN.cancel({ notifications: toCancel }) } catch { /* ignore */ }

        const notifications = []
        for (const lead of leads) {
          const at = new Date(due.getTime() - lead * 24 * 60 * 60_000)
          if (at.getTime() <= Date.now() + 30_000) continue
          notifications.push({
            id: notifId(item.id, lead),
            title: titleForLead(item, lead),
            body: `${name} (₹${amt}) ${whenLabel(lead)}. Tap to mark paid.`,
            schedule: { at, allowWhileIdle: true },
            extra: {
              url: `/recurring?confirm=${item.id}`,
              recurringId: item.id,
              relatedType: 'RECURRING_TRANSACTION',
              relatedId: item.id,
              paid: true,
            },
            channelId: CHANNEL,
          })
        }
        if (notifications.length) {
          await LN.schedule({ notifications })
        }
      }
    } catch { /* ignore */ }
  }

  // In-app bell only when this cycle still needs payment (not after Mark paid)
  if (item.due === false || item.canMarkPaid === false) return

  const msUntil = due.getTime() - Date.now()
  const twoDays = 2 * 24 * 60 * 60_000
  if (msUntil >= 0 && msUntil <= twoDays) {
    const lead = msUntil <= 12 * 60 * 60_000 ? 0 : msUntil <= 36 * 60 * 60_000 ? 1 : 2
    if (lead < intervalDays) {
      addLocalAppNotification({
        title: titleForLead(item, lead),
        body: `${name} (₹${amt}) ${whenLabel(lead)}`,
        url: `/recurring?confirm=${item.id}`,
        kind: isSubscriptionRecurring(item) ? 'subscription' : 'recurring',
        relatedId: String(item.id),
        relatedType: 'RECURRING_TRANSACTION',
      })
    }
  }
}

export async function cancelSubscriptionReminders(recurringId) {
  if (!recurringId) return
  removeLocalAppNotificationsForRelated(recurringId, ['subscription', 'due', 'recurring'])
  const LN = await getLN()
  if (!LN) return
  try {
    await LN.cancel({
      notifications: [2, 1, 0].map((d) => ({ id: notifId(recurringId, d) })),
    })
  } catch { /* ignore */ }
}

/** Reschedule all recurring / subscription / autopay dues (skips daily). */
export async function syncAllSubscriptionReminders(items) {
  for (const item of items || []) {
    if (isDailyRecurring(item)) {
      await cancelSubscriptionReminders(item.id)
      continue
    }
    await scheduleSubscriptionReminders(item)
  }
}
