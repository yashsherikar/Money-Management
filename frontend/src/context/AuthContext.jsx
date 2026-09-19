import { createContext, useContext, useState } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  function persist(data) {
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify({ id: data.userId, email: data.email, name: data.name }))
    setUser({ id: data.userId, email: data.email, name: data.name })
  }

  async function login(email, password) {
    const { data } = await client.post('/auth/login', { email, password })
    persist(data)
  }

  async function signup(email, password, name) {
    const { data } = await client.post('/auth/signup', { email, password, name })
    persist(data)
  }

  function logout() {
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
