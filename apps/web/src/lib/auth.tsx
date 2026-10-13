import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setAccessToken } from './api'

export type SessionUser = {
  id: string
  email: string
  name: string
  headline: string
  location: string
  phone: string
  linkedinUrl: string
  websiteUrl: string
  timezone: string
  theme: 'light' | 'dark' | 'system'
  emailReminders: boolean
}

type AuthValue = {
  user: SessionUser | null
  ready: boolean
  setUser: (user: SessionUser | null) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api<SessionUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      setUser,
      async signIn(email, password) {
        const result = await api<{ accessToken: string; user: SessionUser }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        setAccessToken(result.accessToken)
        setUser(result.user)
      },
      async signUp(name, email, password) {
        const result = await api<{ accessToken: string; user: SessionUser }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        })
        setAccessToken(result.accessToken)
        setUser(result.user)
      },
      async signOut() {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
        setAccessToken(null)
        setUser(null)
      },
    }),
    [ready, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
