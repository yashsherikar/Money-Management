import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import { enablePush, disablePush, isPushEnabled, isPushSupported } from '../push.js'
import { isNativePlatform, isNativePushEnabled, enableNativePush, disableNativePush } from '../nativePush.js'
import { ensureNotificationPermissions } from '../utils/notificationBootstrap.js'
import { isBiometricEnabled } from '../biometricLock.js'
import { isPinSet as isAppLockSet } from '../appLock.js'
import {
  isPaymentNotifySupported,
  isPaymentNotifyEnabled,
  openPaymentNotifySettings,
  getLastPaymentNotifyRaw,
} from '../utils/paymentNotify.js'
import {
  isSmsPaySupported,
  checkSmsPermission,
  requestSmsPermission,
  getSmsBatteryStatus,
  requestIgnoreBatteryOptimizations,
  openSmsAutostartSettings,
  ensureSmsBackgroundAllowed,
} from '../utils/smsPayWatch.js'
import { countWaitingP2pPays } from '../utils/pendingP2pPays.js'

export default function Settings() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [pinSet, setPinSet] = useState(false)

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  const [pinForm, setPinForm] = useState({ currentPassword: '', pin: '', confirm: '' })
  const [pinError, setPinError] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  const [pinFormOpen, setPinFormOpen] = useState(false)
  const [pwFormOpen, setPwFormOpen] = useState(false)

  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [testResults, setTestResults] = useState(null)
  const [testBusy, setTestBusy] = useState(false)
  const [payNotifyOn, setPayNotifyOn] = useState(false)
  const [lastPayRaw, setLastPayRaw] = useState(null)
  const [smsOk, setSmsOk] = useState(false)
  const [smsBatteryOk, setSmsBatteryOk] = useState(true)
  const [smsOem, setSmsOem] = useState('')
  const [waitingCount, setWaitingCount] = useState(0)

  function load() {
    client.get('/profile').then((res) => setPinSet(res.data.pinSet))
  }

  const native = isNativePlatform()

  async function refreshPayNotify() {
    if (!isPaymentNotifySupported()) return
    setPayNotifyOn(await isPaymentNotifyEnabled())
    setLastPayRaw(await getLastPaymentNotifyRaw())
  }

  useEffect(() => {
    load()
    ;(native ? isNativePushEnabled() : isPushEnabled()).then(setPushOn)
    refreshPayNotify()
    async function refreshSms() {
      if (!isSmsPaySupported()) return
      const p = await checkSmsPermission()
      setSmsOk(!!p?.granted)
      setWaitingCount(countWaitingP2pPays())
      if (p?.granted) {
        const b = await getSmsBatteryStatus()
        setSmsBatteryOk(!!b?.ignoringOptimizations)
        setSmsOem([b?.brand, b?.manufacturer].filter(Boolean).join(' / '))
      }
    }
    refreshSms()
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refreshPayNotify()
        refreshSms()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  async function togglePush() {
    setPushError('')
    setPushBusy(true)
    try {
      if (pushOn) {
        await (native ? disableNativePush(client) : disablePush(client))
        setPushOn(false)
      } else {
        if (native) {
          const result = await ensureNotificationPermissions({ refreshPush: true })
          if (!result.push) {
            throw new Error(t('Notification permission was denied, or registration failed. Check Android Settings → Apps → Money Manager → Notifications, then try again.'))
          }
        } else {
          await enablePush(client)
        }
        setPushOn(true)
      }
    } catch (err) {
      setPushError(err.message || t('Save failed'))
    } finally {
      setPushBusy(false)
    }
  }

  async function sendTestPush() {
    setTestBusy(true)
    setTestResults(null)
    try {
      const { data } = await client.post('/push/test')
      setTestResults(data)
    } catch (err) {
      setTestResults({ vapidConfigured: false, subscriptionCount: 0, results: [err.response?.data?.message || t('Save failed')] })
    } finally {
      setTestBusy(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPwError('')
    setPwSaved(false)
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError(t("New passwords don't match"))
      return
    }
    try {
      await client.put('/profile/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      })
      setPwSaved(true)
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
      setPwFormOpen(false)
    } catch (err) {
      setPwError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function handlePinSubmit(e) {
    e.preventDefault()
    setPinError('')
    setPinSaved(false)
    if (pinForm.pin !== pinForm.confirm) {
      setPinError(t("PINs don't match"))
      return
    }
    try {
      await client.put('/profile/pin', { currentPassword: pinForm.currentPassword, pin: pinForm.pin })
      setPinSaved(true)
      setPinForm({ currentPassword: '', pin: '', confirm: '' })
      setPinFormOpen(false)
      load()
    } catch (err) {
      setPinError(err.response?.data?.message || t('Save failed'))
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Settings')}</h1>

      <div className="max-w-3xl space-y-6">
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{t('Push notifications')}</h2>
              <p className="text-xs text-slate-500 mt-1">{t('Get notified on this device when someone requests money from you.')}</p>
            </div>
            {native || isPushSupported() ? (
              <button
                onClick={togglePush}
                disabled={pushBusy}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${pushOn ? 'border border-slate-300' : 'bg-brand-500 hover:bg-brand-600 text-white'}`}
              >
                {pushOn ? t('Disable') : t('Enable')}
              </button>
            ) : (
              <span className="text-xs text-slate-400">{t('Not supported in this browser')}</span>
            )}
          </div>
          {pushError && <div className="mt-2 text-sm text-red-600">{pushError}</div>}
          {pushOn && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={sendTestPush}
                disabled={testBusy}
                className="text-sm text-brand-600 disabled:opacity-60"
              >
                {testBusy ? t('Sending...') : t('Send test notification')}
              </button>
              <p className="text-xs text-slate-500 mt-1">{t('Close the app fully after enabling, then send a test — a real notification should still arrive.')}</p>
              {testResults && (
                <div className="mt-2 text-xs bg-slate-50 rounded p-2 space-y-1">
                  <div>{t('VAPID configured on server')}: {testResults.vapidConfigured ? t('yes') : t('NO')}</div>
                  <div>{t('Subscriptions found')}: {testResults.subscriptionCount}</div>
                  {testResults.results.map((r, i) => <div key={i} className="text-slate-600">{r}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {native && false && (
          <div className="bg-white rounded-xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t('Payment notification access')}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {t('Read GPay/PhonePe payment alerts to auto-log expenses by category. Turn on once in system settings.')}
                </p>
                <p className={`text-xs mt-2 font-medium ${payNotifyOn ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {payNotifyOn ? t('Enabled') : t('Off — tap Enable to open system settings')}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await openPaymentNotifySettings()
                  setTimeout(refreshPayNotify, 1500)
                }}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
                  payNotifyOn ? 'border border-slate-300' : 'bg-brand-500 hover:bg-brand-600 text-white'
                }`}
              >
                {payNotifyOn ? t('Open settings') : t('Enable')}
              </button>
            </div>
            {lastPayRaw?.title || lastPayRaw?.text ? (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-600 mb-1">{t('Last payment notification (for tuning)')}</div>
                <pre className="text-[11px] bg-slate-50 rounded p-2 whitespace-pre-wrap break-words text-slate-600">
                  {JSON.stringify(lastPayRaw, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        )}

        {native && (
          <div className="bg-white rounded-xl p-6">
            <h2 className="font-semibold">{t('Payment notification access')}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('Auto-track from GPay alerts is off in this install build (Play Protect blocks apps that request notification access). Pay, Scan QR, and manual logging still work. We can turn auto-track on later via Play Store.')}
            </p>
          </div>
        )}

        {native && isSmsPaySupported() && (
          <div className="bg-white rounded-xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t('Bank SMS')}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {t('Live debit/credit SMS only — works even if the app was closed. Past inbox is never imported. Ads, scam, and spam are ignored.')}
                </p>
                <p className={`text-xs mt-2 font-medium ${smsOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {smsOk ? t('SMS permission on') : t('SMS permission off')}
                  {waitingCount > 0 ? ` · ${waitingCount} ${t('waiting')}` : ''}
                </p>
                {smsOk && (
                  <p className={`text-xs mt-1 font-medium ${smsBatteryOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {smsBatteryOk
                      ? t('Background: Unrestricted (SMS works when app is killed)')
                      : t('Background restricted — Battery Saver may block SMS when app is closed')}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {!smsOk ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await requestSmsPermission()
                      setSmsOk(!!r?.granted)
                      if (r?.granted) {
                        const b = await getSmsBatteryStatus()
                        setSmsBatteryOk(!!b?.ignoringOptimizations)
                      }
                    }}
                    className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium"
                  >
                    {t('Enable')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/pending-pays')}
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-medium"
                  >
                    {t('Pending pays')}
                  </button>
                )}
              </div>
            </div>
            {smsOk && !smsBatteryOk && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-900">
                  {t('Turn off Battery Saver for Money Manager (set Battery → Unrestricted). Otherwise Android may not deliver bank SMS when the app is killed.')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await ensureSmsBackgroundAllowed({ force: true })
                      const b = await getSmsBatteryStatus()
                      setSmsBatteryOk(!!b?.ignoringOptimizations)
                    }}
                    className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium"
                  >
                    {t('Allow background')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await openSmsAutostartSettings()
                    }}
                    className="border border-amber-300 bg-white rounded-md px-3 py-1.5 text-sm font-medium text-amber-900"
                  >
                    {t('Autostart / OEM settings')}
                  </button>
                </div>
                {smsOem ? (
                  <p className="text-[11px] text-amber-800/80 mt-2">
                    {t('Phone')}: {smsOem}
                  </p>
                ) : null}
              </div>
            )}
            {smsOk && smsBatteryOk && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await openSmsAutostartSettings()
                  }}
                  className="border border-slate-300 rounded-md px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {t('Autostart / OEM settings')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await requestIgnoreBatteryOptimizations()
                    const b = await getSmsBatteryStatus()
                    setSmsBatteryOk(!!b?.ignoringOptimizations)
                  }}
                  className="border border-slate-300 rounded-md px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {t('Battery settings')}
                </button>
              </div>
            )}
          </div>
        )}

        {native && (
          <div className="bg-white rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{t('App lock')}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {isAppLockSet()
                    ? (isBiometricEnabled() ? t('PIN + biometric unlock enabled') : t('PIN unlock enabled'))
                    : t('Not set up yet')}
                </p>
              </div>
              <button onClick={() => navigate('/onboarding')} className="text-sm text-brand-600 font-medium">{t('Change')}</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{pinSet ? t('Change secret PIN') : t('Set a secret PIN')}</h2>
            {!pinFormOpen && (
              <button onClick={() => setPinFormOpen(true)} className="text-sm text-brand-600 font-medium">{t('Change')}</button>
            )}
          </div>
          {pinFormOpen && (
            <form onSubmit={handlePinSubmit} className="mt-3">
              <p className="text-xs text-slate-500 mb-4">{t('A 4-6 digit PIN just for revealing your total balance — separate from your login password.')}</p>
              <input
                type="password" required placeholder={t('Current password')}
                value={pinForm.currentPassword} onChange={(e) => setPinForm({ ...pinForm, currentPassword: e.target.value })}
                className="w-full mb-3"
              />
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  type="password" required inputMode="numeric" pattern="\d{4,6}" placeholder={t('New PIN (4-6 digits)')}
                  value={pinForm.pin} onChange={(e) => setPinForm({ ...pinForm, pin: e.target.value })}
                />
                <input
                  type="password" required inputMode="numeric" placeholder={t('Confirm PIN')}
                  value={pinForm.confirm} onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value })}
                />
              </div>
              {pinError && <div className="mb-3 text-sm text-red-600">{pinError}</div>}
              {pinSaved && <div className="mb-3 text-sm text-emerald-600">{t('Saved.')}</div>}
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">
                  {t('Save PIN')}
                </button>
                <button type="button" onClick={() => setPinFormOpen(false)} className="px-3 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('Change password')}</h2>
            {!pwFormOpen && (
              <button onClick={() => setPwFormOpen(true)} className="text-sm text-brand-600 font-medium">{t('Change')}</button>
            )}
          </div>
          {pwFormOpen && (
            <form onSubmit={handlePasswordSubmit} className="mt-3">
              <input
                type="password" required placeholder={t('Current password')}
                value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                className="w-full mb-3"
              />
              <input
                type="password" required minLength={6} placeholder={t('New password')}
                value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                className="w-full mb-3"
              />
              <input
                type="password" required minLength={6} placeholder={t('Confirm new password')}
                value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                className="w-full mb-3"
              />
              {pwError && <div className="mb-3 text-sm text-red-600">{pwError}</div>}
              {pwSaved && <div className="mb-3 text-sm text-emerald-600">{t('Saved.')}</div>}
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md py-3 font-bold">
                  {t('Change password')}
                </button>
                <button type="button" onClick={() => setPwFormOpen(false)} className="px-3 py-2 rounded-md border border-slate-300">{t('Cancel')}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
