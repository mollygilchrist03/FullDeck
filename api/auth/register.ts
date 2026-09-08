import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { isValidEmail, normalizeEmail, passwordProblem } from '../../src/lib/auth.js'
import { sanitizeName } from '../../src/lib/leaderboard.js'
import { isCleanName } from '../../src/lib/profanity.js'
import {
  clientIp,
  createSession,
  hashPassword,
  loginThrottled,
  originLooksForeign,
  publicUser,
  sessionCookie,
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

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    if (existing.length > 0) {
      res.status(409).json({ error: 'An account with that email already exists.' })
      return
    }

    const [row] = await db
      .insert(users)
      .values({ email, passwordHash: hashPassword(body.password as string), displayName })
      .returning()

    const token = await createSession(db, row.id)
    res.setHeader('Set-Cookie', sessionCookie(token))
    res.status(201).json({ user: publicUser(row) })
  } catch (err) {
    console.error('[api/auth/register]', err)
    res.status(500).json({ error: 'Could not create the account.' })
  }
}
