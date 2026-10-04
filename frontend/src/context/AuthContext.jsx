import { createContext, useContext, useEffect, useState } from 'react'
import client from '../api/client'
import { isNativePlatform } from '../nativePush.js'
import { disablePush, isPushSupported } from '../push.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user')
      const token = localStorage.getItem('token')
      if (!raw || !token) return null
      return JSON.parse(raw)
    } catch {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      return null
    }
  })

  useEffect(() => {
    function onLogout() {
      setUser(null)
    }
    window.addEventListener('mm-auth-logout', onLogout)
    return () => window.removeEventListener('mm-auth-logout', onLogout)
  }, [])

  function persist(data) {
    if (!data?.token) throw new Error('Login response missing token')
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify({ id: data.userId, email: data.email, name: data.name }))
    setUser({ id: data.userId, email: data.email, name: data.name })
    try {
      window.dispatchEvent(new Event('mm-auth-login'))
    } catch { /* ignore */ }
  }

  async function login(email, password) {
    const { data } = await client.post('/auth/login', { email, password, platform: isNativePlatform() ? 'NATIVE' : 'WEB' })
    persist(data)
  }

  async function signup(email, password, name) {
    const { data } = await client.post('/auth/signup', { email, password, name, platform: isNativePlatform() ? 'NATIVE' : 'WEB' })
    persist(data)
  }

  async function logout() {
    // Native app: keep receiving push after logout (re-engagement). Web: stop it,
    // since a shared/public browser shouldn't keep notifying a logged-out session.
    // Awaited before clearing the token so these requests still go out authenticated.
    const cleanup = [client.post('/auth/logout').catch(() => {})]
    if (!isNativePlatform() && isPushSupported()) {
      cleanup.push(disablePush(client).catch(() => {}))
    }
    await Promise.allSettled(cleanup)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
