import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { passwordProblem } from '../../src/lib/auth.js'
import {
  consumeEmailToken,
  destroyAllSessions,
  hashPassword,
  originLooksForeign,
} from '../../server/auth.js'

/** Set a new password from a reset-link token, then log every session out. */
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
