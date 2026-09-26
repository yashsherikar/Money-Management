import { Capacitor } from '@capacitor/core'
import { BiometricAuth, AndroidBiometryStrength } from '@aparajita/capacitor-biometric-auth'

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

export async function isBiometricAvailable() {
  if (!isNativePlatform()) return false
  const result = await BiometricAuth.checkBiometry()
  return result.isAvailable
}

export function isBiometricEnabled() {
  return localStorage.getItem('biometricLoginEnabled') === 'true'
}

export function setBiometricEnabled(enabled) {
  localStorage.setItem('biometricLoginEnabled', enabled ? 'true' : 'false')
}

/** Resolves on success, rejects with a BiometryError on failure/cancel. */
export function authenticateWithBiometric() {
  return BiometricAuth.authenticate({
    reason: 'Unlock Money Manager',
    cancelTitle: 'Use password instead',
    allowDeviceCredential: true,
    androidTitle: 'Money Manager',
    androidSubtitle: 'Unlock with biometrics',
    androidBiometryStrength: AndroidBiometryStrength.weak,
  })
}
