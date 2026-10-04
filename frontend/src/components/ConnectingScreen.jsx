import { useEffect, useState, useSyncExternalStore } from 'react'
import { subscribeWake, getWakeSnapshot, getWakeMeta } from '../utils/wakeBackend.js'
import { useLanguage } from '../context/LanguageContext.jsx'

/**
 * Full-bleed “connecting to server” while Render cold-starts (10–90s).
 * Only shown after 5s so warm opens never flash a progress screen.
 */
export default function ConnectingScreen() {
  const { t } = useLanguage()
  const waking = useSyncExternalStore(subscribeWake, getWakeSnapshot)
  const [visible, setVisible] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [attempt, setAttempt] = useState(1)

  useEffect(() => {
    if (!waking) {
      setVisible(false)
      setElapsed(0)
      return undefined
    }
    const showTimer = setTimeout(() => setVisible(true), 5000)
    const tick = setInterval(() => {
      const meta = getWakeMeta()
      if (meta.startedAt) setElapsed(Math.floor((Date.now() - meta.startedAt) / 1000))
      setAttempt(meta.attempt || 1)
    }, 250)
    return () => {
      clearTimeout(showTimer)
      clearInterval(tick)
    }
  }, [waking])

  if (!waking || !visible) return null

  // Soft progress: approaches ~92% by 60s, never claims 100% until done
  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsed / 28)) * 100))

  let status = t('Connecting to server…')
  if (elapsed >= 12) status = t('Waking the server — this can take a minute…')
  if (elapsed >= 35) status = t('Still connecting — almost there…')
  if (attempt >= 3) status = t('Retrying connection…')

  return (
    <div className="connecting-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="connecting-screen-glow" aria-hidden />
      <div className="connecting-screen-card">
        <img src="/logo-32.png" alt="" className="connecting-screen-logo" width={56} height={56} />
        <div className="connecting-screen-brand">Money Manager</div>
        <p className="connecting-screen-status">{status}</p>
        <div className="connecting-screen-track" aria-hidden>
          <div className="connecting-screen-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="connecting-screen-meta">
          <span>{elapsed > 0 ? `${elapsed}s` : '…'}</span>
          <span>{progress}%</span>
        </div>
        <p className="connecting-screen-hint">
          {t('Free server sleeps when idle. Your data is safe — hang tight.')}
        </p>
      </div>
    </div>
  )
}
