/**
 * Local alerts for emergency-fund monthly dues: 2d / 1d / due day @ 9am.
 */
import { Capacitor } from '@capacitor/core'
import { addLocalAppNotification, removeLocalAppNotificationsForRelated } from './localAppNotifications.js'

const NOTIF_BASE = 84000
const CHANNEL = 'subscriptions'

function notifId(planId, leadDays) {
  const id = Number(planId) || 0
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

function nextDueDate(plan) {
  if (!plan?.active) return null
  const day = Math.min(28, Number(plan.dayOfMonth) || 1)
  const now = new Date()
  let y = now.getFullYear()
  let m = now.getMonth()
  let candidate = new Date(y, m, day, 10, 0, 0)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`
  if (candidate < todayStart || plan.lastLoggedMonth === monthKey) {
    m += 1
    if (m > 11) { m = 0; y += 1 }
    candidate = new Date(y, m, day, 10, 0, 0)
  }
  return candidate
}

function whenLabel(leadDays) {
  if (leadDays === 0) return 'is due today'
  if (leadDays === 1) return 'is due tomorrow'
  return `is due in ${leadDays} days`
}

export async function scheduleEmergencyFundReminders(plan) {
  if (!plan?.active || !plan?.id) {
    await cancelEmergencyFundReminders(plan?.id)
    return
  }
  const due = nextDueDate(plan)
  if (!due || Number.isNaN(due.getTime())) return

  const amt = Number(plan.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
  const from = plan.sourceAccountName || plan.sourceAccount?.name || 'bank'
  const to = plan.targetAccountName || plan.targetAccount?.name || 'emergency fund'
  const bodyBase = `₹${amt} ${from} → ${to}`

  const LN = await getLN()
  if (LN) {
    try {
      const perm = await LN.checkPermissions()
      if (perm.display !== 'granted') await LN.requestPermissions()
      const again = await LN.checkPermissions()
      if (again.display === 'granted') {
        const toCancel = [2, 1, 0].map((d) => ({ id: notifId(plan.id, d) }))
        try { await LN.cancel({ notifications: toCancel }) } catch { /* ignore */ }

        const notifications = []
        for (const lead of [2, 1, 0]) {
          const at = new Date(due.getTime() - lead * 24 * 60 * 60_000)
          if (at.getTime() <= Date.now() + 30_000) continue
          notifications.push({
            id: notifId(plan.id, lead),
            title: lead === 0 ? 'Emergency fund due today' : `Emergency fund due in ${lead} day${lead > 1 ? 's' : ''}`,
            body: `${bodyBase} ${whenLabel(lead)}. Tap to confirm.`,
            schedule: { at, allowWhileIdle: true },
            extra: {
              url: `/obligations?confirmEf=${plan.id}`,
              relatedType: 'EMERGENCY_FUND',
              relatedId: plan.id,
            },
            channelId: CHANNEL,
          })
        }
        if (notifications.length) await LN.schedule({ notifications })
      }
    } catch { /* ignore */ }
  }

  const msUntil = due.getTime() - Date.now()
  const twoDays = 2 * 24 * 60 * 60_000
  if (msUntil >= 0 && msUntil <= twoDays) {
    const lead = msUntil <= 12 * 60 * 60_000 ? 0 : msUntil <= 36 * 60 * 60_000 ? 1 : 2
    addLocalAppNotification({
      title: lead === 0 ? 'Emergency fund due today' : `Emergency fund due in ${lead} day${lead > 1 ? 's' : ''}`,
      body: `${bodyBase} ${whenLabel(lead)}`,
      url: `/obligations?confirmEf=${plan.id}`,
      kind: 'emergency_fund',
      relatedId: String(plan.id),
      relatedType: 'EMERGENCY_FUND',
    })
  }
}

export async function cancelEmergencyFundReminders(planId) {
  if (!planId) return
  removeLocalAppNotificationsForRelated(planId, ['emergency_fund', 'due'])
  const LN = await getLN()
  if (!LN) return
  try {
    await LN.cancel({
      notifications: [2, 1, 0].map((d) => ({ id: notifId(planId, d) })),
    })
  } catch { /* ignore */ }
}

export async function syncAllEmergencyFundReminders(plans) {
  for (const plan of plans || []) {
    await scheduleEmergencyFundReminders(plan)
  }
}
