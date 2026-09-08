import { createContext, useContext } from 'react'
import type { AccountUser } from '../lib/auth'

export interface AuthResult {
  ok: boolean
  error?: string
}

export interface AuthState {
  user: AccountUser | null
  /** True until the first /api/auth/me resolves. */
  loading: boolean
  /** Whether the deployment has Google sign-in configured. */
  googleEnabled: boolean
  /** Whether outgoing email (verify / reset links) is configured. */
  mailEnabled: boolean
  /** Whether accounts are configured at all (database present). */
  configured: boolean
  register: (email: string, password: string, displayName: string) => Promise<AuthResult>
  login: (email: string, password: string) => Promise<AuthResult>
  logout: () => Promise<void>
  updateAccount: (patch: { displayName?: string; autoPost?: boolean }) => Promise<AuthResult>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
