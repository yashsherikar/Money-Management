import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
})

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
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
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
    const isAuthEndpoint = err.config?.url?.includes('/auth/')
    if (!isAuthEndpoint && (status === 401 || status === 403)) {
      // Only log out when the token is actually gone or expired. Otherwise surface
      // the error on the page instead of wiping the session and reloading.
      if (!tokenStillValid()) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      } else {
        console.error('Server rejected an authenticated request:', err.config?.method, err.config?.url, status, err.response?.data)
      }
    }
    return Promise.reject(err)
  },
)

export default client
