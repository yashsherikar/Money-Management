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

client.interceptors.response.use(
  (res) => {
    pendingCount--
    notifyLoading()
    return res
  },
  (err) => {
    pendingCount--
    notifyLoading()
    const isAuthEndpoint = err.config?.url?.includes('/auth/')
    if (!isAuthEndpoint && (err.response?.status === 401 || err.response?.status === 403)) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default client
