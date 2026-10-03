/**
 * Local alerts for subscriptions: 2 days before, 1 day before, due day
 * (same cadence as backend push reminders).
 */
import { Capacitor } from '@capacitor/core'
import { addLocalAppNotification } from './localAppNotifications.js'
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

/**
 * Schedule local notifications for one subscription (2d / 1d / due day @ 9am).
 */
export async function scheduleSubscriptionReminders(item) {
  if (!isSubscriptionRecurring(item) || !item?.active) {
    await cancelSubscriptionReminders(item?.id)
    return
  }
  const due = nextDueDate(item)
  if (!due || Number.isNaN(due.getTime())) return

  const brand = brandFromRecurringDescription(item.description)
  const name = brand?.name || item.description || 'Subscription'
  const amt = Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

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
        for (const lead of [2, 1, 0]) {
          const at = new Date(due.getTime() - lead * 24 * 60 * 60_000)
          if (at.getTime() <= Date.now() + 30_000) continue
          notifications.push({
            id: notifId(item.id, lead),
            title: lead === 0 ? 'Subscription due today' : `Subscription due in ${lead} day${lead > 1 ? 's' : ''}`,
            body: `${name} (₹${amt}) ${whenLabel(lead)}. Tap to mark paid.`,
            schedule: { at },
            extra: { url: `/recurring?confirm=${item.id}`, recurringId: item.id },
            channelId: CHANNEL,
          })
        }
        if (notifications.length) {
          await LN.schedule({ notifications })
        }
      }
    } catch { /* ignore */ }
  }

  // In-app bell: if due within 2 days, surface now
  const msUntil = due.getTime() - Date.now()
  const twoDays = 2 * 24 * 60 * 60_000
  if (msUntil >= 0 && msUntil <= twoDays) {
    const lead = msUntil <= 12 * 60 * 60_000 ? 0 : msUntil <= 36 * 60 * 60_000 ? 1 : 2
    addLocalAppNotification({
      title: lead === 0 ? 'Subscription due today' : `Subscription due in ${lead} day${lead > 1 ? 's' : ''}`,
      body: `${name} (₹${amt}) ${whenLabel(lead)}`,
      url: `/recurring?confirm=${item.id}`,
      kind: 'subscription',
      relatedId: String(item.id),
    })
  }
}

export async function cancelSubscriptionReminders(recurringId) {
  if (!recurringId) return
  const LN = await getLN()
  if (!LN) return
  try {
    await LN.cancel({
      notifications: [2, 1, 0].map((d) => ({ id: notifId(recurringId, d) })),
    })
  } catch { /* ignore */ }
}

/** Reschedule all subscription recurring items. */
export async function syncAllSubscriptionReminders(items) {
  const list = (items || []).filter(isSubscriptionRecurring)
  for (const item of list) {
    await scheduleSubscriptionReminders(item)
  }
}
