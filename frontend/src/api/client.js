import axios from 'axios'

// Render free-tier cold starts often take 15–50s. Without a timeout axios waits
// forever (default 0), which leaves the app stuck on "Loading...".
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
  timeout: 60_000,
})

/** User-facing message for failed requests (timeouts, network, API errors). */
export function networkErrorMessage(err, fallback = 'Request failed') {
  if (err?.code === 'ECONNABORTED') {
    return 'Server is taking too long (maybe waking up). Tap retry.'
  }
  return err?.response?.data?.message || err?.message || fallback
}

let pendingCount = 0
const loadingListeners = new Set()
function notifyLoading() {
  loadingListeners.forEach((listener) => listener())
}
export function subscribeLoading(listener) {
  loadingListeners.add(listener)
  return () => loadingListeners.delete(listener)
}
export function getLoadingSnapshot() {
  return pendingCount > 0
}

client.interceptors.request.use((config) => {
  pendingCount++
  notifyLoading()
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Reads the `exp` claim straight out of the JWT, so a spurious 401 from one
 *  endpoint can't destroy a session whose token is demonstrably still valid. */
function tokenStillValid() {
  const token = localStorage.getItem('token')
  if (!token) return false
  try {
    const part = token.split('.')[1]
    if (!part) return false
    // JWT uses base64url — pad before atob or parse fails and every 401 logs you out
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 5_000
  } catch {
    return false
  }
}

function clearSessionSoft() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  // Soft logout — full window.location reload breaks Capacitor SPA / causes login loops
  window.dispatchEvent(new Event('mm-auth-logout'))
}

client.interceptors.response.use(
  (res) => {
    pendingCount--
    notifyLoading()
    return res
  },
  (err) => {
    pendingCount--
    notifyLoading()
    const status = err.response?.status
    const url = err.config?.url || ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/signup')
    const message = String(err.response?.data?.message || '')
    const sessionRevoked = message.includes('session revoked')
    if (!isAuthEndpoint && status === 401) {
      // Only hard-logout when token is expired/missing, or server revoked the session.
      // Never use window.location.href here — that loops on Capacitor.
      if (!tokenStillValid() || sessionRevoked) {
        clearSessionSoft()
      } else {
        console.error('Server rejected an authenticated request:', err.config?.method, url, status, err.response?.data)
      }
    }
    return Promise.reject(err)
  },
)

export default client
