import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'
import { isNativePlatform } from '../nativePush.js'
import {
  isPaymentNotifySupported,
  isPaymentNotifyEnabled,
  openPaymentNotifySettings,
} from '../utils/paymentNotify.js'
import ModalPortal from '../utils/ModalPortal.jsx'
import { useBodyScrollLock } from '../utils/useBodyScrollLock.js'

const ASKED_KEY = 'mm_pay_notify_asked'

/**
 * One-time soft ask for Notification Access (read GPay/PhonePe payment alerts).
 * Optional — Pay still works if the user skips.
 */
export default function PaymentNotifyAsk() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  useBodyScrollLock(open)

  useEffect(() => {
    if (!isNativePlatform() || !isPaymentNotifySupported()) return undefined
    if (localStorage.getItem(ASKED_KEY) === '1') return undefined

    let cancelled = false
    ;(async () => {
      const enabled = await isPaymentNotifyEnabled()
      if (cancelled) return
      if (enabled) {
        localStorage.setItem(ASKED_KEY, '1')
        return
      }
      setTimeout(() => {
        if (!cancelled) setOpen(true)
      }, 800)
    })()

    return () => { cancelled = true }
  }, [])

  function dismiss() {
    localStorage.setItem(ASKED_KEY, '1')
    setOpen(false)
  }

  async function enable() {
    localStorage.setItem(ASKED_KEY, '1')
    setOpen(false)
    await openPaymentNotifySettings()
  }

  if (!open) return null

  return (
    <ModalPortal>
      <div className="app-modal" role="dialog" aria-modal="true">
        <div className="app-modal-backdrop" onClick={dismiss} />
        <div className="app-modal-panel">
          <div className="app-modal-body">
            <h2 className="font-bold text-lg mb-2">{t('Auto-track UPI payments?')}</h2>
            <p className="text-sm text-slate-600 mb-3 leading-relaxed">
              {t('Allow notification access so we can read GPay/PhonePe payment alerts and log expenses by category. We only use payment notifications — Pay still works if you skip.')}
            </p>
            <ul className="text-xs text-slate-500 mb-4 space-y-1 list-disc pl-4">
              <li>{t('Optional — you can turn this on later in Settings')}</li>
              <li>{t('On-device only — not uploaded to our servers')}</li>
            </ul>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={enable}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-md py-3 font-semibold"
              >
                {t('Allow notification access')}
              </button>
              <button type="button" onClick={dismiss} className="w-full py-2.5 text-sm text-slate-500">
                {t('Not now')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
