import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'
import { isNativePlatform } from '../nativePush.js'
import { isLoggedIn } from '../utils/userStorage.js'
import {
  isSmsPaySupported,
  checkSmsPermission,
  requestSmsPermission,
  getSmsBatteryStatus,
  requestIgnoreBatteryOptimizations,
  openSmsAutostartSettings,
} from '../utils/smsPayWatch.js'
import ModalPortal from '../utils/ModalPortal.jsx'
import { useBodyScrollLock } from '../utils/useBodyScrollLock.js'

/** Per app session only — "Ask me later" re-shows on next open. */
const LATER_SESSION_KEY = 'mm_sms_bg_ask_later_session'

/**
 * Soft ask (new + old users): bank SMS needs SMS permission + Unrestricted battery
 * so messages still arrive when the app is closed/killed.
 * Allow → system dialogs. Ask me later → hide until next app open.
 */
export default function SmsBackgroundAsk() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [smsOk, setSmsOk] = useState(false)
  const [batteryOk, setBatteryOk] = useState(true)
  const [oem, setOem] = useState('')
  useBodyScrollLock(open)

  const laterThisSession = () => {
    try {
      return sessionStorage.getItem(LATER_SESSION_KEY) === '1'
    } catch {
      return false
    }
  }

  const markLater = () => {
    try {
      sessionStorage.setItem(LATER_SESSION_KEY, '1')
    } catch { /* ignore */ }
  }

  const evaluate = useCallback(async () => {
    if (!isNativePlatform() || !isSmsPaySupported()) return
    if (!isLoggedIn()) return
    if (laterThisSession()) {
      setOpen(false)
      return
    }

    const perm = await checkSmsPermission()
    const bat = await getSmsBatteryStatus()
    const smsGranted = !!perm?.granted
    const unrestricted = !!bat?.ignoringOptimizations
    setSmsOk(smsGranted)
    setBatteryOk(unrestricted)
    setOem([bat?.brand, bat?.manufacturer].filter(Boolean).join(' · '))

    if (smsGranted && unrestricted) {
      setOpen(false)
      return
    }

    setTimeout(() => setOpen(true), 700)
  }, [])

  useEffect(() => {
    evaluate()
    const onVis = () => {
      if (document.visibilityState === 'visible') evaluate()
    }
    const onAuth = () => evaluate()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    window.addEventListener('mm-auth-login', onAuth)
    window.addEventListener('mm-sms-permission-changed', onAuth)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
      window.removeEventListener('mm-auth-login', onAuth)
      window.removeEventListener('mm-sms-permission-changed', onAuth)
    }
  }, [evaluate])

  function askLater() {
    markLater()
    setOpen(false)
  }

  async function allow() {
    if (busy) return
    setBusy(true)
    try {
      if (!smsOk) {
        const r = await requestSmsPermission()
        setSmsOk(!!r?.granted)
        if (!r?.granted) {
          setBusy(false)
          return
        }
      }
      await requestIgnoreBatteryOptimizations()
      const bat = await getSmsBatteryStatus()
      if (!bat?.ignoringOptimizations) {
        await openSmsAutostartSettings()
      }
      const again = await getSmsBatteryStatus()
      const perm = await checkSmsPermission()
      setSmsOk(!!perm?.granted)
      setBatteryOk(!!again?.ignoringOptimizations)
      if (perm?.granted && again?.ignoringOptimizations) {
        setOpen(false)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <ModalPortal>
      <div className="app-modal" role="dialog" aria-modal="true">
        <div className="app-modal-backdrop" onClick={askLater} />
        <div className="app-modal-panel">
          <div className="app-modal-body">
            <h2 className="font-bold text-lg mb-2">
              {t('Allow background for bank SMS?')}
            </h2>
            <p className="text-sm text-slate-600 mb-3 leading-relaxed">
              {t('So Money Manager can read new debit/credit SMS even when the app is closed or killed, Android must set Battery to Unrestricted. Without this, Battery Saver often blocks SMS.')}
            </p>
            <ul className="text-xs text-slate-500 mb-4 space-y-1.5 list-disc pl-4">
              <li>{t('Live bank SMS only — past inbox is never imported')}</li>
              <li>{t('Works for new and existing users who have not allowed this yet')}</li>
              <li>{t('You can also turn this on later in Settings → Bank SMS')}</li>
              {!smsOk ? (
                <li className="text-amber-700 font-medium">
                  {t('SMS permission is also needed — Allow will request it first')}
                </li>
              ) : null}
              {oem ? (
                <li>
                  {t('Phone')}: {oem}
                </li>
              ) : null}
            </ul>

            {!batteryOk && smsOk ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                {t('Status: SMS on, background still restricted')}
              </p>
            ) : null}
            {!smsOk ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                {t('Status: SMS permission off')}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={allow}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-md py-3 font-semibold disabled:opacity-60"
              >
                {busy ? t('Opening…') : t('Allow')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={askLater}
                className="w-full py-2.5 text-sm text-slate-500"
              >
                {t('Ask me later')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
