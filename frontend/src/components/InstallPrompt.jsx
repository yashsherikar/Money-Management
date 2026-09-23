import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function InstallPrompt() {
  const { t } = useLanguage()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('installPromptDismissed') === '1')
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setDismissed(true)
    localStorage.setItem('installPromptDismissed', '1')
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  if (installed || dismissed) return null

  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-[calc(100%-2rem)]">
        <img src="/logo-32.png" alt="" className="w-8 h-8 rounded-md flex-shrink-0" />
        <div className="flex-1 text-sm">{t('Install Money Manager on your device for quick access')}</div>
        <button onClick={handleInstall} className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap">{t('Install')}</button>
        <button onClick={dismiss} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>
    )
  }

  if (isIOS()) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-[calc(100%-2rem)] text-sm">
        <img src="/logo-32.png" alt="" className="w-8 h-8 rounded-md flex-shrink-0" />
        <span className="flex-1">{t('To install: tap Share, then "Add to Home Screen"')}</span>
        <button onClick={dismiss} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>
    )
  }

  return null
}
