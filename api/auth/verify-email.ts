import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { consumeEmailToken, originLooksForeign } from '../../server/auth.js'

/** Confirm an email address from a one-time link token. */
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
