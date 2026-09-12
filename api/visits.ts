import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, sql } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../db/client.js'
import { siteVisits } from '../db/schema.js'
import { originLooksForeign } from '../server/auth.js'

const ROW_ID = 1

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured) {
    res.status(200).json({ count: null })
    return
  }

  try {
    const db = getDb()

    if (req.method === 'POST') {
      if (originLooksForeign(req.headers)) {
        res.status(403).json({ error: 'Request rejected.' })
        return
      }
      const [row] = await db
        .insert(siteVisits)
        .values({ id: ROW_ID, count: 1 })
        .onConflictDoUpdate({
          target: siteVisits.id,
          set: { count: sql`${siteVisits.count} + 1` },
        })
        .returning({ count: siteVisits.count })
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ count: row.count })
      return
    }

    if (req.method === 'GET') {
      const [row] = await db
        .select({ count: siteVisits.count })
        .from(siteVisits)
        .where(eq(siteVisits.id, ROW_ID))
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ count: row?.count ?? 0 })
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (err) {
    console.error('[api/visits]', err)
    res.status(500).json({ error: 'Could not reach the visit counter.' })
  }
}
