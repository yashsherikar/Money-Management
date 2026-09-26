import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'
import { enablePush, disablePush, isPushEnabled, isPushSupported } from '../push.js'
import { isNativePlatform, isNativePushEnabled, enableNativePush, disableNativePush } from '../nativePush.js'
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled, authenticateWithBiometric } from '../biometricLock.js'

export default function Settings() {
  const { t } = useLanguage()
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

  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioOn, setBioOn] = useState(isBiometricEnabled())
  const [bioBusy, setBioBusy] = useState(false)
  const [bioError, setBioError] = useState('')

  function load() {
    client.get('/profile').then((res) => setPinSet(res.data.pinSet))
  }

  const native = isNativePlatform()

  useEffect(() => {
    load()
    ;(native ? isNativePushEnabled() : isPushEnabled()).then(setPushOn)
    if (native) isBiometricAvailable().then(setBioAvailable)
  }, [])

  async function toggleBiometric() {
    setBioError('')
    setBioBusy(true)
    try {
      await authenticateWithBiometric()
      const next = !bioOn
      setBiometricEnabled(next)
      setBioOn(next)
    } catch (err) {
      setBioError(err.message || t('Biometric check failed'))
    } finally {
      setBioBusy(false)
    }
  }

  async function togglePush() {
    setPushError('')
    setPushBusy(true)
    try {
      if (pushOn) {
        await (native ? disableNativePush(client) : disablePush(client))
        setPushOn(false)
      } else {
        await (native ? enableNativePush(client) : enablePush(client))
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

        {native && bioAvailable && (
          <div className="bg-white rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{t('Biometric login')}</h2>
                <p className="text-xs text-slate-500 mt-1">{t('Unlock the app with your fingerprint or face instead of re-entering your password.')}</p>
              </div>
              <button
                onClick={toggleBiometric}
                disabled={bioBusy}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${bioOn ? 'border border-slate-300' : 'bg-brand-500 hover:bg-brand-600 text-white'}`}
              >
                {bioOn ? t('Disable') : t('Enable')}
              </button>
            </div>
            {bioError && <div className="mt-2 text-sm text-red-600">{bioError}</div>}
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
