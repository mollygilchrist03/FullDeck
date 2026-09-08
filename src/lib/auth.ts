/**
 * Auth input rules shared by the React forms (instant feedback) and the
 * `api/auth/*` serverless functions (the authority). No DOM, no Node APIs.
 */

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 100

// Deliberately loose — just enough to catch obvious typos, not to enforce a
// spec. The real check is "does a confirmation ever land"; we don't send one.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value)
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** null when the password is acceptable, otherwise a human-readable reason. */
export function passwordProblem(value: unknown): string | null {
  if (typeof value !== 'string') return 'Enter a password.'
  if (value.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (value.length > PASSWORD_MAX) return 'That password is too long.'
  return null
}

/** Shape of the account object the client is given — never the password hash. */
export interface AccountUser {
  id: number
  email: string
  displayName: string
  autoPost: boolean
  emailVerified: boolean
  hasPassword: boolean
  hasGoogle: boolean
}
