import { Capacitor } from '@capacitor/core'
import { waitingP2pPays, updatePendingP2pPay, listPendingP2pPays } from './pendingP2pPays.js'
import {
  addLocalAppNotification,
  removeLocalAppNotificationsForPending,
} from './localAppNotifications.js'

const REMIND_AFTER_MS = 15 * 60_000
const NOTIF_ID_BASE = 71000

function notifIdForPending(pendingId) {
  let h = 0
  const s = String(pendingId || '')
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return NOTIF_ID_BASE + (Math.abs(h) % 20000)
}

async function getLocalNotifications() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const mod = await import('@capacitor/local-notifications')
    return mod.LocalNotifications
  } catch {
    return null
  }
}

/** Schedule system notification + mark remindAt on pending item. Call after addPendingP2pPay. */
export async function schedulePendingPayReminder(pending) {
  if (!pending?.id) return
  const remindAt = (pending.createdAt || Date.now()) + REMIND_AFTER_MS
  updatePendingP2pPay(pending.id, {
    remindAt,
    reminded: false,
  })

  const LN = await getLocalNotifications()
  if (!LN) return

  try {
    const perm = await LN.checkPermissions()
    if (perm.display !== 'granted') {
      await LN.requestPermissions()
    }
    const again = await LN.checkPermissions()
    if (again.display !== 'granted') return

    const id = notifIdForPending(pending.id)
    try {
      await LN.cancel({ notifications: [{ id }] })
    } catch { /* ignore */ }

    const amt = Number(pending.amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const who = pending.pn || pending.pa || 'UPI'
    await LN.schedule({
      notifications: [
        {
          id,
          title: 'Pending UPI pay',
          body: `Still waiting for bank SMS — ₹${amt} to ${who}. Tap to check.`,
          schedule: { at: new Date(remindAt), allowWhileIdle: true },
          extra: { url: '/pending-pays', pendingId: pending.id },
          channelId: 'pending_pays',
        },
      ],
    })
  } catch { /* ignore */ }
}

export async function cancelPendingPayReminder(pendingId) {
  if (!pendingId) return
  removeLocalAppNotificationsForPending(pendingId)
  const LN = await getLocalNotifications()
  if (!LN) return
  try {
    await LN.cancel({ notifications: [{ id: notifIdForPending(pendingId) }] })
  } catch { /* ignore */ }
}

/**
 * If 15 min passed and still waiting → in-app bell notification (once per pending).
 * Also creates channel on Android when possible.
 */
export async function checkPendingPayRemindersDue() {
  const waiting = waitingP2pPays()
  const now = Date.now()
  for (const p of waiting) {
    const remindAt = p.remindAt || ((p.createdAt || 0) + REMIND_AFTER_MS)
    if (p.reminded) continue
    if (now < remindAt) continue

    const amt = Number(p.amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const who = p.pn || p.pa || 'UPI'
    addLocalAppNotification({
      title: 'Pending UPI pay',
      body: `No bank SMS yet for ₹${amt} to ${who}. Open Pending pays to check or mark paid.`,
      url: '/pending-pays',
      kind: 'pending_pay',
      relatedId: p.id,
    })
    updatePendingP2pPay(p.id, { reminded: true, remindAt })

    // Ensure a system notification exists if schedule was missed (app was killed)
    const LN = await getLocalNotifications()
    if (LN) {
      try {
        const perm = await LN.checkPermissions()
        if (perm.display === 'granted') {
          await LN.schedule({
            notifications: [
              {
                id: notifIdForPending(p.id),
                title: 'Pending UPI pay',
                body: `Still waiting for bank SMS — ₹${amt} to ${who}.`,
                schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true },
                extra: { url: '/pending-pays', pendingId: p.id },
                channelId: 'pending_pays',
              },
            ],
          })
        }
      } catch { /* ignore */ }
    }
  }
}

/** Cancel reminders for confirmed/removed pays; ensure waiting ones have remindAt. */
export async function syncPendingPayReminders() {
  const all = listPendingP2pPays()
  for (const p of all) {
    if (p.status === 'waiting_sms' || p.status === 'pending') {
      if (!p.remindAt) {
        await schedulePendingPayReminder(p)
      }
    } else {
      await cancelPendingPayReminder(p.id)
    }
  }
  await checkPendingPayRemindersDue()
}

let reminderTimer = null

export function startPendingPayReminderWatcher() {
  if (reminderTimer) return () => {}
  syncPendingPayReminders()
  reminderTimer = setInterval(() => {
    checkPendingPayRemindersDue()
  }, 30_000)

  const onChange = () => {
    checkPendingPayRemindersDue()
  }
  const onVis = () => {
    if (document.visibilityState === 'visible') checkPendingPayRemindersDue()
  }
  window.addEventListener('mm-pending-p2p-changed', onChange)
  document.addEventListener('visibilitychange', onVis)

  // Channel + tap routing: notificationBootstrap.bootstrapNotifications()

  return () => {
    if (reminderTimer) clearInterval(reminderTimer)
    reminderTimer = null
    window.removeEventListener('mm-pending-p2p-changed', onChange)
    document.removeEventListener('visibilitychange', onVis)
  }
}
