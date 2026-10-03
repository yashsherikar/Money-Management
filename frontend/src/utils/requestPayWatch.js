/**
 * Start watching live SMS after paying a payment-request / split / contribution.
 */
import { savePendingUpiConfirm, suppressResumeLock } from '../appLock.js'
import { copyVpaAndOpenApp, formatUpiAmount } from './upiQr.js'
import { addPendingP2pPay } from './pendingP2pPays.js'
import { requestSmsPermission, isSmsPaySupported, checkSmsPermission } from './smsPayWatch.js'
import { upsertSavedContact } from './savedContacts.js'

/**
 * Open UPI + queue pending for SMS match (name + amount + time).
 */
export async function startRequestPayWatch({
  kind = 'payment_request',
  requestId = null,
  participantId = null,
  notificationId = null,
  pa,
  amount,
  name = '',
  pn = '',
  email = '',
  phone = '',
  app = 'gpay',
} = {}) {
  const cleanPa = String(pa || '').trim()
  const am = formatUpiAmount(amount)
  if (!cleanPa || !am) throw new Error('Missing UPI ID or amount')

  const who = String(pn || name || '').trim()
  suppressResumeLock(15 * 60_000)

  savePendingUpiConfirm({
    kind,
    requestId,
    participantId,
    notificationId,
    pa: cleanPa,
    am,
    amount: am,
    name: who || cleanPa,
    pn: who,
  })

  addPendingP2pPay({
    pa: cleanPa,
    pn: who,
    amount: Number(am),
    personal: true,
    kind,
    requestId,
    participantId,
    notificationId,
  })

  upsertSavedContact({
    name: who,
    email,
    phone,
    upiId: cleanPa,
    pa: cleanPa,
  })

  await copyVpaAndOpenApp({ pa: cleanPa, amount: am, pn: who, app })

  if (isSmsPaySupported()) {
    const perm = await checkSmsPermission()
    if (!perm?.granted) await requestSmsPermission().catch(() => {})
  }
}
