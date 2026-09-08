import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AccountUser } from '../lib/auth'
import { AuthContext, type AuthResult, type AuthState } from './authContext'

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    throw new Error('The accounts API is not available here — try the deployed site.')
  }
  if (!res.ok) throw new Error((data.error as string) ?? 'Request failed.')
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [configured, setConfigured] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { headers: { accept: 'application/json' } })
      const data = (await res.json()) as {
        user: AccountUser | null
        googleEnabled?: boolean
        configured?: boolean
      }
      setUser(data.user ?? null)
      setGoogleEnabled(Boolean(data.googleEnabled))
      setConfigured(data.configured !== false)
    } catch {
      setUser(null)
      setConfigured(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const wrap = useCallback(
    async (fn: () => Promise<Record<string, unknown>>): Promise<AuthResult> => {
      try {
        const data = await fn()
        if (data.user) setUser(data.user as AccountUser)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong.' }
      }
    },
    [],
  )

  const value: AuthState = {
    user,
    loading,
    googleEnabled,
    configured,
    register: (email, password, displayName) =>
      wrap(() => postJson('/api/auth/register', { email, password, displayName })),
    login: (email, password) => wrap(() => postJson('/api/auth/login', { email, password })),
    logout: async () => {
      try {
        await postJson('/api/auth/logout')
      } catch {
        /* clear locally regardless */
      }
      setUser(null)
    },
    updateAccount: (patch) => wrap(() => postJson('/api/auth/account', patch)),
    refresh,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
