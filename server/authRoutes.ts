import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../db/client.js'
import { users } from '../db/schema.js'
import { isValidEmail, normalizeEmail, passwordProblem } from '../src/lib/auth.js'
import { sanitizeName } from '../src/lib/leaderboard.js'
import { isCleanName } from '../src/lib/profanity.js'
import {
  clearSessionCookie,
  clientIp,
  consumeEmailToken,
  createEmailToken,
  createSession,
  destroyAllSessions,
  destroySession,
  hashPassword,
  loginThrottled,
  originLooksForeign,
  publicUser,
  sessionCookie,
  sessionUser,
  verifyPassword,
} from './auth.js'
import { googleConfigured } from './google.js'
import { mailConfigured, originOf, sendMail } from './mail.js'

/**
 * Every `/api/auth/*` handler lives here as a plain function. `api/auth/[action].ts`
 * is the only serverless function — it dispatches by the last path segment. This
 * keeps the deployment well under the Hobby-plan function cap.
 */
export type AuthHandler = (req: VercelRequest, res: VercelResponse) => Promise<void>

const VERIFY_TTL_MS = 24 * 3600_000
const RESET_TTL_MS = 60 * 60_000 // 1 hour

function notConfigured(res: VercelResponse): void {
  res.status(503).json({ error: 'Accounts are not configured on this deployment.' })
}

function methodNotAllowed(res: VercelResponse): void {
  res.setHeader('Allow', 'POST')
  res.status(405).json({ error: 'Method not allowed.' })
}

/** Shared guard for the POST-only, same-origin handlers. Returns true if the
 * request should proceed; otherwise it has already answered. */
function guardPost(req: VercelRequest, res: VercelResponse, requireDb = true): boolean {
  if (requireDb && !isDbConfigured) {
    notConfigured(res)
    return false
  }
  if (req.method !== 'POST') {
    methodNotAllowed(res)
    return false
  }
  if (originLooksForeign(req.headers)) {
    res.status(403).json({ error: 'Request rejected.' })
    return false
  }
  return true
}

export const register: AuthHandler = async (req, res) => {
  if (!guardPost(req, res)) return
  try {
    const db = getDb()
    if (await loginThrottled(db, clientIp(req.headers, req.socket?.remoteAddress ?? 'unknown'))) {
      res.status(429).json({ error: 'Too many attempts — try again in a bit.' })
      return
    }

    const body = (req.body ?? {}) as Record<string, unknown>
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "That doesn't look like an email address." })
      return
    }
    const pwProblem = passwordProblem(body.password)
    if (pwProblem) {
      res.status(400).json({ error: pwProblem })
      return
    }
    const displayName = sanitizeName(body.displayName)
    if (!displayName) {
      res.status(400).json({ error: 'Pick a display name.' })
      return
    }
    if (!isCleanName(displayName)) {
      res.status(400).json({ error: 'Please pick a display name without profanity.' })
      return
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (existing.length > 0) {
      res.status(409).json({ error: 'An account with that email already exists.' })
      return
    }

    const [row] = await db
      .insert(users)
      .values({ email, passwordHash: hashPassword(body.password as string), displayName })
      .returning()

    // Fire off a verification email — best effort, never blocks signup.
    try {
      const vToken = await createEmailToken(db, row.id, 'verify', VERIFY_TTL_MS)
      const link = `${originOf(req.headers)}/account/verify?token=${vToken}`
      await sendMail(
        email,
        'Confirm your Full Deck email',
        `Welcome to Full Deck.\n\nConfirm this address:\n${link}\n\nThe link is good for 24 hours. If you didn't sign up, ignore this.`,
      )
    } catch (mailErr) {
      console.error('[api/auth/register] verification email failed', mailErr)
    }

    const token = await createSession(db, row.id)
    res.setHeader('Set-Cookie', sessionCookie(token))
    res.status(201).json({ user: publicUser(row) })
  } catch (err) {
    console.error('[api/auth/register]', err)
    res.status(500).json({ error: 'Could not create the account.' })
  }
}

export const login: AuthHandler = async (req, res) => {
  if (!guardPost(req, res)) return
  try {
    const db = getDb()
    if (await loginThrottled(db, clientIp(req.headers, req.socket?.remoteAddress ?? 'unknown'))) {
      res.status(429).json({ error: 'Too many attempts — try again in a bit.' })
      return
    }

    const body = (req.body ?? {}) as Record<string, unknown>
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
    const password = typeof body.password === 'string' ? body.password : ''

    const rows =
      isValidEmail(email) && password
        ? await db.select().from(users).where(eq(users.email, email)).limit(1)
        : []
    const row = rows[0]

    // One generic message for "no such user" and "wrong password" — no
    // account-enumeration through the login form.
    if (!row || !row.passwordHash || !verifyPassword(password, row.passwordHash)) {
      res.status(401).json({ error: 'Wrong email or password.' })
      return
    }

    const token = await createSession(db, row.id)
    res.setHeader('Set-Cookie', sessionCookie(token))
    res.status(200).json({ user: publicUser(row) })
  } catch (err) {
    console.error('[api/auth/login]', err)
    res.status(500).json({ error: 'Could not sign you in.' })
  }
}

export const logout: AuthHandler = async (req, res) => {
  if (req.method !== 'POST') {
    methodNotAllowed(res)
    return
  }
  if (originLooksForeign(req.headers)) {
    res.status(403).json({ error: 'Request rejected.' })
    return
  }
  try {
    if (isDbConfigured) await destroySession(getDb(), req.headers.cookie)
  } catch (err) {
    console.error('[api/auth/logout]', err)
  }
  // Always clear the cookie and report success — logging out shouldn't fail.
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.status(200).json({ ok: true })
}

export const me: AuthHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const googleEnabled = googleConfigured()
  const mailEnabled = mailConfigured()
  if (!isDbConfigured) {
    res.status(200).json({ user: null, configured: false, googleEnabled, mailEnabled })
    return
  }
  try {
    const row = await sessionUser(getDb(), req.headers.cookie)
    res
      .status(200)
      .json({ user: row ? publicUser(row) : null, configured: true, googleEnabled, mailEnabled })
  } catch (err) {
    console.error('[api/auth/me]', err)
    res.status(200).json({ user: null, configured: true, googleEnabled, mailEnabled })
  }
}

export const account: AuthHandler = async (req, res) => {
  if (!guardPost(req, res)) return
  try {
    const db = getDb()
    const who = await sessionUser(db, req.headers.cookie)
    if (!who) {
      res.status(401).json({ error: 'Sign in first.' })
      return
    }

    const body = (req.body ?? {}) as Record<string, unknown>
    const patch: { displayName?: string; autoPost?: boolean } = {}

    if (body.displayName !== undefined) {
      const name = sanitizeName(body.displayName)
      if (!name) {
        res.status(400).json({ error: 'Pick a display name.' })
        return
      }
      if (!isCleanName(name)) {
        res.status(400).json({ error: 'Please pick a display name without profanity.' })
        return
      }
      patch.displayName = name
    }
    if (typeof body.autoPost === 'boolean') patch.autoPost = body.autoPost

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'Nothing to update.' })
      return
    }

    const [row] = await db.update(users).set(patch).where(eq(users.id, who.id)).returning()
    res.status(200).json({ user: publicUser(row) })
  } catch (err) {
    console.error('[api/auth/account]', err)
    res.status(500).json({ error: 'Could not update your account.' })
  }
}

export const verifyEmail: AuthHandler = async (req, res) => {
  if (!guardPost(req, res)) return
  try {
    const token = (req.body as Record<string, unknown>)?.token
    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'Missing token.' })
      return
    }
    const db = getDb()
    const userId = await consumeEmailToken(db, token, 'verify')
    if (userId == null) {
      res.status(400).json({ error: 'That link is invalid or has expired.' })
      return
    }
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId))
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[api/auth/verify-email]', err)
    res.status(500).json({ error: 'Could not confirm your email.' })
  }
}

export const requestReset: AuthHandler = async (req, res) => {
  if (!guardPost(req, res)) return

  const done = () =>
    res
      .status(200)
      .json({ ok: true, message: 'If that email has an account, a reset link is on its way.' })

  try {
    const db = getDb()
    if (await loginThrottled(db, clientIp(req.headers, req.socket?.remoteAddress ?? 'unknown'))) {
      res.status(429).json({ error: 'Too many attempts — try again in a bit.' })
      return
    }

    const email = normalizeEmail(String((req.body as Record<string, unknown>)?.email ?? ''))
    if (!isValidEmail(email)) {
      done()
      return
    }
    const [row] = await db
      .select({ id: users.id, hasPassword: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    // Only send to accounts that actually have a password to reset.
    if (row && row.hasPassword) {
      try {
        const token = await createEmailToken(db, row.id, 'reset', RESET_TTL_MS)
        const link = `${originOf(req.headers)}/account/reset?token=${token}`
        await sendMail(
          email,
          'Reset your Full Deck password',
          `Someone asked to reset the password for this Full Deck account.\n\nSet a new one:\n${link}\n\nThe link is good for 1 hour. If it wasn't you, ignore this — nothing has changed.`,
        )
      } catch (mailErr) {
        console.error('[api/auth/request-reset] mail failed', mailErr)
      }
    }
    done()
  } catch (err) {
    console.error('[api/auth/request-reset]', err)
    done() // still don't leak anything
  }
}

export const resetPassword: AuthHandler = async (req, res) => {
  if (!guardPost(req, res)) return
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const pwProblem = passwordProblem(body.password)
    if (pwProblem) {
      res.status(400).json({ error: pwProblem })
      return
    }
    if (typeof body.token !== 'string' || !body.token) {
      res.status(400).json({ error: 'Missing token.' })
      return
    }

    const db = getDb()
    const userId = await consumeEmailToken(db, body.token, 'reset')
    if (userId == null) {
      res.status(400).json({ error: 'That link is invalid or has expired.' })
      return
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(body.password as string), emailVerified: true })
      .where(eq(users.id, userId))
    await destroyAllSessions(db, userId) // force a fresh sign-in everywhere

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[api/auth/reset-password]', err)
    res.status(500).json({ error: 'Could not reset your password.' })
  }
}

export const resendVerification: AuthHandler = async (req, res) => {
  if (!guardPost(req, res)) return
  try {
    const db = getDb()
    if (await loginThrottled(db, clientIp(req.headers, req.socket?.remoteAddress ?? 'unknown'))) {
      res.status(429).json({ error: 'Too many attempts — try again in a bit.' })
      return
    }
    const who = await sessionUser(db, req.headers.cookie)
    if (!who) {
      res.status(401).json({ error: 'Sign in first.' })
      return
    }
    if (who.emailVerified) {
      res.status(200).json({ ok: true, alreadyVerified: true })
      return
    }

    const token = await createEmailToken(db, who.id, 'verify', VERIFY_TTL_MS)
    const link = `${originOf(req.headers)}/account/verify?token=${token}`
    await sendMail(
      who.email,
      'Confirm your Full Deck email',
      `Confirm this address:\n${link}\n\nThe link is good for 24 hours.`,
    )
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[api/auth/resend-verification]', err)
    res.status(500).json({ error: 'Could not send the email.' })
  }
}

export const HANDLERS: Record<string, AuthHandler> = {
  register,
  login,
  logout,
  me,
  account,
  'verify-email': verifyEmail,
  'request-reset': requestReset,
  'reset-password': resetPassword,
  'resend-verification': resendVerification,
}
