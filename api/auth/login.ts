import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { isValidEmail, normalizeEmail } from '../../src/lib/auth.js'
import {
  clientIp,
  createSession,
  loginThrottled,
  originLooksForeign,
  publicUser,
  sessionCookie,
  verifyPassword,
} from '../../server/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured) {
    res.status(503).json({ error: 'Accounts are not configured on this deployment.' })
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }
  if (originLooksForeign(req.headers)) {
    res.status(403).json({ error: 'Request rejected.' })
    return
  }

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
