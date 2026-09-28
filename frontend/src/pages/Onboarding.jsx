import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PinPad from '../components/PinPad.jsx'
import { setAppLockPin } from '../appLock.js'
import { isBiometricAvailable, setBiometricEnabled, authenticateWithBiometric } from '../biometricLock.js'

const FingerprintIcon = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#226DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 0-4 4v3a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
    <path d="M6 10v1a6 6 0 0 0 12 0v-1" />
    <path d="M12 17v5" />
  </svg>
)

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState('create')
  const [pinAttempt, setPinAttempt] = useState(0)
  const [firstPin, setFirstPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioBusy, setBioBusy] = useState(false)
  const [bioError, setBioError] = useState('')

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable)
  }, [])

  function finish() {
    localStorage.setItem('onboardingDone', 'true')
    localStorage.setItem('justOnboardedAt', String(Date.now()))
    navigate('/')
  }

  function handleCreate(pin) {
    setFirstPin(pin)
    setStep('confirm')
  }

  async function handleConfirm(pin) {
    if (pin !== firstPin) {
      setPinError(true)
      return
    }
    await setAppLockPin(pin)
    if (bioAvailable) {
      setStep('biometric')
    } else {
      finish()
    }
  }

  async function enableBiometric() {
    setBioBusy(true)
    setBioError('')
    try {
      await authenticateWithBiometric()
      setBiometricEnabled(true)
      finish()
    } catch {
      setBioError('Could not verify — try again, or skip and use your PIN.')
    } finally {
      setBioBusy(false)
    }
  }

  function skipBiometric() {
    setBiometricEnabled(false)
    finish()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-navy px-4 py-10 gap-10">
      {step !== 'biometric' ? (
        <div key={step} className="animate-page-in">
          <PinPad
            key={step === 'confirm' ? `confirm-${pinAttempt}` : 'create'}
            title={step === 'create' ? 'Create a PIN' : 'Confirm your PIN'}
            subtitle={step === 'create' ? 'You’ll use this to unlock Money Manager' : 'Enter it again to confirm'}
            error={pinError}
            onErrorShown={() => {
              setPinError(false)
              setPinAttempt((n) => n + 1)
              setStep('create')
            }}
            onComplete={step === 'create' ? handleCreate : handleConfirm}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 text-center max-w-xs animate-page-in">
          <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center">{FingerprintIcon}</div>
          <h2 className="text-lg font-bold">Enable biometric unlock?</h2>
          <p className="text-sm text-muted">Use your fingerprint or face for quicker access. Your PIN still works as a backup, including after a few failed scans.</p>
          {bioError && <div className="text-sm text-red-600">{bioError}</div>}
          <button
            onClick={enableBiometric}
            disabled={bioBusy}
            className="w-full bg-brand-500 text-white rounded-full px-6 py-3 font-bold disabled:opacity-60"
          >
            {bioBusy ? 'Checking...' : 'Enable'}
          </button>
          <button onClick={skipBiometric} className="text-sm text-muted underline">Skip, use PIN only</button>
        </div>
      )}
    </div>
  )
}
