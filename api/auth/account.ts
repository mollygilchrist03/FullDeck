import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { sanitizeName } from '../../src/lib/leaderboard.js'
import { isCleanName } from '../../src/lib/profanity.js'
import { originLooksForeign, publicUser, sessionUser } from '../../server/auth.js'

/** Update the signed-in account — display name and/or the auto-post toggle. */
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
    const me = await sessionUser(db, req.headers.cookie)
    if (!me) {
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

    const [row] = await db.update(users).set(patch).where(eq(users.id, me.id)).returning()
    res.status(200).json({ user: publicUser(row) })
  } catch (err) {
    console.error('[api/auth/account]', err)
    res.status(500).json({ error: 'Could not update your account.' })
  }
}
