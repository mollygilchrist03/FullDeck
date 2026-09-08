import type { VercelRequest, VercelResponse } from '@vercel/node'
import { desc, eq } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../db/client.js'
import { gameResults } from '../db/schema.js'
import { isGameKey } from '../src/lib/leaderboard.js'
import { originLooksForeign, sessionUser } from '../server/auth.js'

const MAX_LIST = 50

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured) {
    res.status(503).json({ error: 'Accounts are not configured on this deployment.' })
    return
  }

  try {
    const db = getDb()
    const me = await sessionUser(db, req.headers.cookie)
    if (!me) {
      res.status(401).json({ error: 'Sign in first.' })
      return
    }

    if (req.method === 'GET') {
      const rows = await db
        .select({
          game: gameResults.game,
          score: gameResults.score,
          detail: gameResults.detail,
          postedToLeaderboard: gameResults.postedToLeaderboard,
          createdAt: gameResults.createdAt,
        })
        .from(gameResults)
        .where(eq(gameResults.userId, me.id))
        .orderBy(desc(gameResults.createdAt))
        .limit(MAX_LIST)
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ results: rows })
      return
    }

    if (req.method === 'POST') {
      if (originLooksForeign(req.headers)) {
        res.status(403).json({ error: 'Request rejected.' })
        return
      }
      const body = (req.body ?? {}) as Record<string, unknown>
      if (!isGameKey(body.game)) {
        res.status(400).json({ error: 'Unknown game.' })
        return
      }
      const score =
        typeof body.score === 'number' && Number.isFinite(body.score)
          ? Math.trunc(body.score)
          : 0
      const detail =
        typeof body.detail === 'string' ? body.detail.slice(0, 120) : null

      const [row] = await db
        .insert(gameResults)
        .values({ userId: me.id, game: body.game, score, detail })
        .returning({ id: gameResults.id })
      res.status(201).json({ ok: true, id: row.id })
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (err) {
    console.error('[api/history]', err)
    res.status(500).json({ error: 'Could not reach your history.' })
  }
}
