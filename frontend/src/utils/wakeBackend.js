/**
 * Wake Render free-tier before real API calls.
 * Cold start is often 30–90s; cron-job.org (~30s) frequently fails on first ping.
 */

function pingUrl() {
  const base = String(import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/$/, '')
  return `${base}/ping`
}

let inFlight = null
let lastOkAt = 0
let waking = false
let wakeStartedAt = 0
let wakeAttempt = 0
const wakeListeners = new Set()

function notifyWake() {
  wakeListeners.forEach((fn) => {
    try { fn() } catch { /* ignore */ }
  })
}

function setWaking(next, attempt = 0) {
  waking = next
  if (next) {
    if (!wakeStartedAt) wakeStartedAt = Date.now()
    wakeAttempt = attempt
  } else {
    wakeStartedAt = 0
    wakeAttempt = 0
  }
  notifyWake()
}

export function subscribeWake(listener) {
  wakeListeners.add(listener)
  return () => wakeListeners.delete(listener)
}

export function getWakeSnapshot() {
  return waking
}

export function getWakeMeta() {
  return {
    waking,
    startedAt: wakeStartedAt,
    attempt: wakeAttempt,
    lastOkAt,
  }
}

/** @returns {Promise<boolean>} true if /ping returned OK */
export function wakeBackend({ force = false } = {}) {
  const now = Date.now()
  // Skip if we woke successfully in the last 10 minutes
  if (!force && lastOkAt && now - lastOkAt < 10 * 60_000) {
    return Promise.resolve(true)
  }
  if (inFlight) return inFlight

  setWaking(true, 1)

  inFlight = (async () => {
    const url = pingUrl()
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      setWaking(true, attempt)
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 90_000) : null
      try {
        const res = await fetch(url, {
          method: 'GET',
          cache: 'no-store',
          signal: ctrl?.signal,
        })
        const text = (await res.text().catch(() => '')).trim()
        if (res.ok && (text === 'OK' || text === '')) {
          lastOkAt = Date.now()
          return true
        }
      } catch {
        // cold 502 / timeout — retry
      } finally {
        if (timer) clearTimeout(timer)
      }
      await new Promise((r) => setTimeout(r, 3000))
    }
    return false
  })().finally(() => {
    inFlight = null
    setWaking(false)
  })

  return inFlight
}

/** Start wake ASAP; also re-wake when app returns after a long pause. */
export function startBackendWakeWatcher() {
  wakeBackend().catch(() => {})

  const onVis = () => {
    if (document.visibilityState !== 'visible') return
    // After 12+ min in background, Render may have slept again
    if (!lastOkAt || Date.now() - lastOkAt > 12 * 60_000) {
      wakeBackend({ force: true }).catch(() => {})
    }
  }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('focus', onVis)

  return () => {
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('focus', onVis)
  }
}
